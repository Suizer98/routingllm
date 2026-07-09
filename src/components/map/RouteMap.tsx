import { useEffect, useMemo, useRef } from "react";
import { Layer, Map, Source } from "@vis.gl/react-maplibre";
import type { FeatureCollection } from "geojson";
import type { MapRef } from "@vis.gl/react-maplibre";
import type { FilterSpecification, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { endpointCoordinate } from "@/lib/geocoding";
import {
  END_LAYER_ID,
  END_SOURCE_ID,
  EXPANSION_GLOW_LAYER_ID,
  EXPANSION_LAYER_ID,
  EXPANSION_NODE_LAYER_ID,
  EXPANSION_NODE_SOURCE_ID,
  EXPANSION_SOURCE_ID,
  MAP_STYLE,
  ROUTE_CORE_LAYER_ID,
  ROUTE_HEAD_LAYER_ID,
  ROUTE_HEAD_SOURCE_ID,
  ROUTE_LAYER_ID,
  ROUTE_SOURCE_ID,
  START_LAYER_ID,
  START_SOURCE_ID,
} from "@/lib/constants";
import {
  buildExpansionEdgeCollection,
  buildExpansionNodeCollection,
  buildSettledFlashMap,
  sliceLineString,
} from "@/lib/pathfinding";
import type { ExpansionEdge } from "@/lib/pathfinding";
import { useLayerStore } from "@/stores/layerStore";
import { useLocationStore } from "@/stores/locationStore";
import { useRoutingStore } from "@/stores/routingStore";

function buildInitialViewState(
  start: [number, number],
  end: [number, number],
) {
  return {
    longitude: (start[0] + end[0]) / 2,
    latitude: (start[1] + end[1]) / 2,
    zoom: 6.2,
  };
}

function buildMapBounds(
  start: [number, number],
  end: [number, number],
  routeCoordinates?: [number, number][],
): [[number, number], [number, number]] {
  const points = routeCoordinates?.length
    ? routeCoordinates
    : [start, end];

  let minLng = points[0][0];
  let maxLng = points[0][0];
  let minLat = points[0][1];
  let maxLat = points[0][1];

  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

type RouteMapProps = {
  chromeInsetLeft: number;
};

const HIDE_ALL_FILTER: FilterSpecification = ["==", ["get", "step"], -1];
const MAX_ANIMATION_MS = 10_000;
const PULSE_WIDTH = 3.2;
const OFF_PATH_NODE_FLASH = 0.42;
const ON_PATH_NODE_FLASH = 0.75;

function buildAnimationTiming(goalStep: number, routePointCount: number) {
  const exploreWeight = Math.max(1, goalStep + 1);
  const routeWeight = Math.max(1, routePointCount - 1);
  const totalWeight = exploreWeight + routeWeight;
  const exploreDurationMs = MAX_ANIMATION_MS * (exploreWeight / totalWeight);
  const routeDurationMs = MAX_ANIMATION_MS - exploreDurationMs;

  return { exploreDurationMs, routeDurationMs };
}

function revealStepFilter(maxStep: number): FilterSpecification {
  return ["<=", ["get", "step"], maxStep];
}

const emptyCollection: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function waveFlash(step: number, waveHead: number) {
  return Math.max(0, 1 - Math.abs(step - waveHead) / PULSE_WIDTH);
}

function goalPathPulse(phase: number) {
  return 0.3 + 0.7 * ((Math.sin(phase * Math.PI * 2) + 1) / 2);
}

function buildTravelingFlash(
  edges: ExpansionEdge[],
  waveHead: number,
  revealStep: number,
  goalPathSteps: Set<number>,
  goalPulse: number,
  goalReached: boolean,
) {
  const flashByStep = new globalThis.Map<number, number>();

  if (waveHead >= 0) {
    flashByStep.set(0, waveFlash(0, waveHead));
  }

  for (const edge of edges) {
    if (edge.step > revealStep) {
      continue;
    }

    const flash = waveFlash(edge.step, waveHead);
    if (flash > 0.01) {
      flashByStep.set(edge.step, flash);
    }
  }

  if (goalReached) {
    for (const edge of edges) {
      if (edge.step > revealStep) {
        continue;
      }

      const isGoalPath = goalPathSteps.has(edge.step);
      const baseline = isGoalPath ? goalPulse : OFF_PATH_NODE_FLASH;
      flashByStep.set(edge.step, Math.max(flashByStep.get(edge.step) ?? 0, baseline));
    }

    const startBaseline = goalPathSteps.has(0)
      ? goalPulse * 0.85
      : OFF_PATH_NODE_FLASH;
    flashByStep.set(0, Math.max(flashByStep.get(0) ?? 0, startBaseline));
  }

  return flashByStep;
}

function pointCollection(coordinate: [number, number]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: coordinate },
      },
    ],
  };
}

export function RouteMap({ chromeInsetLeft }: RouteMapProps) {
  const mapRef = useRef<MapRef>(null);
  const layers = useLayerStore((state) => state.layers);
  const route = useRoutingStore((state) => state.route);
  const routeError = useRoutingStore((state) => state.routeError);
  const isLoading = useRoutingStore((state) => state.isLoading);
  const isAnimating = useRoutingStore((state) => state.isAnimating);
  const isAnimationPaused = useRoutingStore((state) => state.isAnimationPaused);
  const animationToken = useRoutingStore((state) => state.animationToken);
  const finishAnimation = useRoutingStore((state) => state.finishAnimation);
  const start = useLocationStore((state) => state.start);
  const end = useLocationStore((state) => state.end);
  const startCoordinate = endpointCoordinate(start);
  const endCoordinate = endpointCoordinate(end);
  const initialViewState = useMemo(
    () => buildInitialViewState(startCoordinate, endCoordinate),
    [startCoordinate, endCoordinate],
  );

  const routeColor =
    (route?.geometry.properties?.color as string | undefined) ?? "#38bdf8";

  const visibility = useMemo(() => {
    return layers.reduce<Record<string, "visible" | "none">>((acc, layer) => {
      const visibilityValue = layer.visible ? "visible" : "none";
      for (const mapLayerId of layer.mapLayerIds) {
        acc[mapLayerId] = visibilityValue;
      }
      return acc;
    }, {});
  }, [layers]);

  const expansionEdgeData = useMemo(() => {
    if (!route) {
      return emptyCollection;
    }
    if (isAnimating) {
      return buildExpansionEdgeCollection(route.expansionEdges);
    }
    const settledFlash = buildSettledFlashMap(
      route.expansionEdges,
      route.goalPathSteps,
      OFF_PATH_NODE_FLASH,
      ON_PATH_NODE_FLASH,
    );
    return buildExpansionEdgeCollection(
      route.expansionEdges,
      settledFlash,
      Infinity,
    );
  }, [isAnimating, route]);

  const expansionNodeData = useMemo(() => {
    if (!route) {
      return emptyCollection;
    }
    if (isAnimating) {
      return buildExpansionNodeCollection(route.expansionEdges, startCoordinate);
    }
    const settledFlash = buildSettledFlashMap(
      route.expansionEdges,
      route.goalPathSteps,
      OFF_PATH_NODE_FLASH,
      ON_PATH_NODE_FLASH,
    );
    return buildExpansionNodeCollection(
      route.expansionEdges,
      startCoordinate,
      settledFlash,
      Infinity,
    );
  }, [isAnimating, route, startCoordinate]);

  const routeInitialData = useMemo(() => {
    if (!route) {
      return null;
    }
    return isAnimating
      ? sliceLineString(route.geometry, 0.001)
      : route.geometry;
  }, [isAnimating, route]);

  useEffect(() => {
    if (!isAnimating || !route) {
      return;
    }

    const map = mapRef.current?.getMap();
    if (!map) {
      return;
    }

    const token = animationToken;
    const goalStep = Math.max(
      0,
      route.goalReachedStep >= 0
        ? route.goalReachedStep
        : route.expansionEdges.length - 1,
    );
    const routeCoords = route.geometry.geometry.coordinates as [number, number][];
    const expansionEdges = route.expansionEdges;
    const goalPathSteps = new Set(route.goalPathSteps);
    const { exploreDurationMs, routeDurationMs } = buildAnimationTiming(
      goalStep,
      routeCoords.length,
    );
    const animationStartedAt = performance.now();
    let elapsedBeforePause = 0;
    let segmentStart = animationStartedAt;
    let wasPaused = false;
    let frameId = 0;

    const getElapsed = () =>
      elapsedBeforePause + (performance.now() - segmentStart);

    const applyExpansionFilter = (maxStep: number) => {
      const filter = revealStepFilter(maxStep);
      if (map.getLayer(EXPANSION_LAYER_ID)) {
        map.setFilter(EXPANSION_LAYER_ID, filter);
      }
      if (map.getLayer(EXPANSION_GLOW_LAYER_ID)) {
        map.setFilter(EXPANSION_GLOW_LAYER_ID, filter);
      }
      if (map.getLayer(EXPANSION_NODE_LAYER_ID)) {
        map.setFilter(EXPANSION_NODE_LAYER_ID, filter);
      }
    };

    const updateExpansionSources = (
      revealStep: number,
      flashByStep: globalThis.Map<number, number>,
    ) => {
      const edgeSource = map.getSource(EXPANSION_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      const nodeSource = map.getSource(EXPANSION_NODE_SOURCE_ID) as
        | GeoJSONSource
        | undefined;

      edgeSource?.setData(
        buildExpansionEdgeCollection(expansionEdges, flashByStep, revealStep),
      );
      nodeSource?.setData(
        buildExpansionNodeCollection(
          expansionEdges,
          startCoordinate,
          flashByStep,
          revealStep,
        ),
      );
    };

    const applyExpansionFade = (edgeFade: number, nodeFade: number) => {
      const glowOpacity: FilterSpecification = [
        "interpolate",
        ["linear"],
        ["get", "flash"],
        0,
        0.14 * edgeFade,
        0.42,
        0.38 * edgeFade,
        1,
        0.42 * edgeFade,
      ];
      const lineOpacity: FilterSpecification = [
        "interpolate",
        ["linear"],
        ["get", "flash"],
        0,
        0.32 * edgeFade,
        0.42,
        0.52 * edgeFade,
        1,
        0.88 * edgeFade,
      ];
      const nodeOpacity: FilterSpecification = [
        "interpolate",
        ["linear"],
        ["get", "flash"],
        0,
        0.5 * nodeFade,
        0.42,
        0.68 * nodeFade,
        1,
        0.95 * nodeFade,
      ];

      if (map.getLayer(EXPANSION_GLOW_LAYER_ID)) {
        map.setPaintProperty(EXPANSION_GLOW_LAYER_ID, "line-opacity", glowOpacity);
      }
      if (map.getLayer(EXPANSION_LAYER_ID)) {
        map.setPaintProperty(EXPANSION_LAYER_ID, "line-opacity", lineOpacity);
      }
      if (map.getLayer(EXPANSION_NODE_LAYER_ID)) {
        map.setPaintProperty(EXPANSION_NODE_LAYER_ID, "circle-opacity", nodeOpacity);
      }
    };

    const frame = () => {
      if (useRoutingStore.getState().animationToken !== token) {
        return;
      }

      const { isAnimationPaused } = useRoutingStore.getState();

      if (isAnimationPaused) {
        if (!wasPaused) {
          elapsedBeforePause += performance.now() - segmentStart;
          wasPaused = true;
        }
        frameId = requestAnimationFrame(frame);
        return;
      }

      if (wasPaused) {
        segmentStart = performance.now();
        wasPaused = false;
      }

      try {
        const elapsed = getElapsed();
        const pulsePhase = elapsed / 900;

        if (elapsed < exploreDurationMs) {
          const exploreProgress = elapsed / exploreDurationMs;
          const waveHead = exploreProgress * goalStep;
          const revealStep = Math.floor(waveHead);
          const goalReached = waveHead >= goalStep - 0.5;

          const flashByStep = buildTravelingFlash(
            expansionEdges,
            waveHead,
            revealStep,
            goalPathSteps,
            goalPathPulse(pulsePhase),
            goalReached,
          );

          applyExpansionFilter(revealStep);
          updateExpansionSources(revealStep, flashByStep);
          applyExpansionFade(1, 1);
        } else if (elapsed < exploreDurationMs + routeDurationMs) {
          const routeElapsed = elapsed - exploreDurationMs;
          const draw = clamp01(routeElapsed / routeDurationMs);

          const flashByStep = buildTravelingFlash(
            expansionEdges,
            goalStep,
            goalStep,
            goalPathSteps,
            goalPathPulse(pulsePhase),
            true,
          );

          applyExpansionFilter(goalStep);
          updateExpansionSources(goalStep, flashByStep);

          const edgeFade = Math.max(0.3, 1 - draw * 0.5);
          const nodeFade = Math.max(0.82, 1 - draw * 0.18);
          applyExpansionFade(edgeFade, nodeFade);

          const sliced = sliceLineString(route.geometry, draw);
          const routeSource = map.getSource(ROUTE_SOURCE_ID) as
            | GeoJSONSource
            | undefined;
          routeSource?.setData(sliced);

          const drawnCoords = sliced.geometry.coordinates as [number, number][];
          const head = drawnCoords[drawnCoords.length - 1];
          const headSource = map.getSource(ROUTE_HEAD_SOURCE_ID) as
            | GeoJSONSource
            | undefined;
          headSource?.setData(
            draw > 0 && draw < 1 ? pointCollection(head) : emptyCollection,
          );
        } else {
          const settledFlash = buildSettledFlashMap(
            expansionEdges,
            route.goalPathSteps,
            OFF_PATH_NODE_FLASH,
            ON_PATH_NODE_FLASH,
          );
          applyExpansionFilter(goalStep);
          updateExpansionSources(goalStep, settledFlash);
          applyExpansionFade(0.75, 1);
          finishAnimation();
          return;
        }
      } catch {
        // sources not ready yet this frame; keep going
      }

      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [animationToken, finishAnimation, isAnimating, route, startCoordinate]);

  const startMarkerData = useMemo(
    () => ({
      type: "Feature" as const,
      properties: { name: start.label },
      geometry: { type: "Point" as const, coordinates: startCoordinate },
    }),
    [start.label, startCoordinate],
  );

  const endMarkerData = useMemo(
    () => ({
      type: "Feature" as const,
      properties: { name: end.label },
      geometry: { type: "Point" as const, coordinates: endCoordinate },
    }),
    [end.label, endCoordinate],
  );

  const routeVisible = visibility[ROUTE_LAYER_ID] ?? "visible";
  const startVisible = visibility[START_LAYER_ID] ?? "visible";
  const endVisible = visibility[END_LAYER_ID] ?? "visible";

  const recenterMap = () => {
    const map = mapRef.current?.getMap();
    if (!map) {
      return;
    }

    const routeCoordinates = route?.geometry.geometry.coordinates as
      | [number, number][]
      | undefined;
    const bounds = buildMapBounds(
      startCoordinate,
      endCoordinate,
      routeCoordinates,
    );
    const isPoint =
      bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1];

    if (isPoint) {
      map.flyTo({
        center: startCoordinate,
        zoom: 10,
        duration: 600,
        padding: {
          top: 80,
          bottom: 80,
          left: chromeInsetLeft + 16,
          right: 48,
        },
      });
      return;
    }

    map.fitBounds(bounds, {
      padding: {
        top: 80,
        bottom: 80,
        left: chromeInsetLeft + 16,
        right: 48,
      },
      maxZoom: 10,
      duration: 600,
    });
  };

  return (
    <div className="absolute inset-0 h-full w-full">
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
      >
        <Source
          id={EXPANSION_SOURCE_ID}
          type="geojson"
          data={expansionEdgeData}
        >
          <Layer
            id={EXPANSION_GLOW_LAYER_ID}
            type="line"
            filter={HIDE_ALL_FILTER}
            layout={{
              "line-join": "round",
              "line-cap": "round",
              visibility: routeVisible,
            }}
            paint={{
              "line-color": routeColor,
              "line-width": [
                "interpolate",
                ["linear"],
                ["get", "flash"],
                0,
                4,
                1,
                11,
              ],
              "line-opacity": [
                "interpolate",
                ["linear"],
                ["get", "flash"],
                0,
                0.1,
                1,
                0.42,
              ],
              "line-blur": 3,
            }}
          />
          <Layer
            id={EXPANSION_LAYER_ID}
            type="line"
            filter={HIDE_ALL_FILTER}
            layout={{
              "line-join": "round",
              "line-cap": "round",
              visibility: routeVisible,
            }}
            paint={{
              "line-color": [
                "interpolate",
                ["linear"],
                ["get", "flash"],
                0,
                routeColor,
                1,
                "#ffffff",
              ],
              "line-width": [
                "interpolate",
                ["linear"],
                ["get", "flash"],
                0,
                1.2,
                1,
                2.5,
              ],
              "line-opacity": [
                "interpolate",
                ["linear"],
                ["get", "flash"],
                0,
                0.28,
                1,
                0.88,
              ],
            }}
          />
        </Source>

        <Source
          id={EXPANSION_NODE_SOURCE_ID}
          type="geojson"
          data={expansionNodeData}
        >
          <Layer
            id={EXPANSION_NODE_LAYER_ID}
            type="circle"
            filter={HIDE_ALL_FILTER}
            layout={{ visibility: routeVisible }}
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "flash"],
                0,
                3,
                0.42,
                3.8,
                1,
                5,
              ],
              "circle-color": [
                "interpolate",
                ["linear"],
                ["get", "flash"],
                0,
                routeColor,
                0.42,
                "#7dd3fc",
                1,
                "#ffffff",
              ],
              "circle-opacity": [
                "interpolate",
                ["linear"],
                ["get", "flash"],
                0,
                0.5,
                0.42,
                0.68,
                1,
                0.95,
              ],
              "circle-stroke-width": [
                "interpolate",
                ["linear"],
                ["get", "flash"],
                0,
                1,
                0.42,
                1.2,
                1,
                1.5,
              ],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-opacity": [
                "interpolate",
                ["linear"],
                ["get", "flash"],
                0,
                0.3,
                0.42,
                0.45,
                1,
                0.75,
              ],
              "circle-blur": 0.05,
            }}
          />
        </Source>

        {routeInitialData ? (
          <Source
            id={ROUTE_SOURCE_ID}
            type="geojson"
            data={routeInitialData}
            lineMetrics
          >
            <Layer
              id={`${ROUTE_LAYER_ID}-glow`}
              type="line"
              layout={{
                "line-join": "round",
                "line-cap": "round",
                visibility: routeVisible,
              }}
              paint={{
                "line-color": routeColor,
                "line-width": 20,
                "line-opacity": isAnimating ? 0.3 : 0.4,
                "line-blur": 10,
              }}
            />
            <Layer
              id={ROUTE_LAYER_ID}
              type="line"
              layout={{
                "line-join": "round",
                "line-cap": "round",
                visibility: routeVisible,
              }}
              paint={{
                "line-color": routeColor,
                "line-width": 8,
                "line-opacity": isAnimating ? 0.6 : 0.75,
                "line-blur": 2,
              }}
            />
            {isAnimating ? (
              <Layer
                id={ROUTE_CORE_LAYER_ID}
                type="line"
                layout={{
                  "line-join": "round",
                  "line-cap": "round",
                  visibility: routeVisible,
                }}
                paint={{
                  "line-color": "#ffffff",
                  "line-width": 3,
                  "line-opacity": 0.95,
                }}
              />
            ) : (
              <Layer
                id={ROUTE_CORE_LAYER_ID}
                type="line"
                layout={{
                  "line-join": "round",
                  "line-cap": "round",
                  visibility: routeVisible,
                }}
                paint={{
                  "line-width": 4,
                  "line-opacity": 1,
                  "line-gradient": [
                    "interpolate",
                    ["linear"],
                    ["line-progress"],
                    0,
                    "#4ade80",
                    0.12,
                    routeColor,
                    0.88,
                    routeColor,
                    1,
                    "#f87171",
                  ],
                }}
              />
            )}
          </Source>
        ) : null}

        <Source id={ROUTE_HEAD_SOURCE_ID} type="geojson" data={emptyCollection}>
          <Layer
            id={ROUTE_HEAD_LAYER_ID}
            type="circle"
            layout={{ visibility: routeVisible }}
            paint={{
              "circle-radius": 7,
              "circle-color": "#ffffff",
              "circle-opacity": 0.95,
              "circle-stroke-color": routeColor,
              "circle-stroke-width": 3,
            }}
          />
        </Source>

        <Source id={START_SOURCE_ID} type="geojson" data={startMarkerData}>
          <Layer
            id={START_LAYER_ID}
            type="circle"
            layout={{ visibility: startVisible }}
            paint={{
              "circle-radius": 8,
              "circle-color": "#16a34a",
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2.5,
              "circle-opacity": 1,
            }}
          />
        </Source>

        <Source id={END_SOURCE_ID} type="geojson" data={endMarkerData}>
          <Layer
            id={END_LAYER_ID}
            type="circle"
            layout={{ visibility: endVisible }}
            paint={{
              "circle-radius": 8,
              "circle-color": "#dc2626",
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            }}
          />
        </Source>
      </Map>

      <button
        type="button"
        className="absolute bottom-4 z-[4] flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-xl border border-slate-700 bg-slate-800 p-0 text-slate-100 shadow-lg transition-[left,background-color] duration-200 ease-out hover:bg-slate-700/80"
        onClick={recenterMap}
        aria-label="Recenter map on route"
        style={{ left: chromeInsetLeft }}
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 3h6v6" />
          <path d="M9 21H3v-6" />
          <path d="M21 3l-7 7" />
          <path d="M3 21l7-7" />
        </svg>
      </button>

      <div
        className={`absolute top-4 right-4 z-[1] rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 shadow-lg ${
          routeError ? "text-red-400" : ""
        }`}
      >
        {routeError ? (
          routeError
        ) : route ? (
          <>
            {(route.geometry.properties?.name as string) ?? "Route"} ·{" "}
            {route.distanceKm.toFixed(0)} km · {route.durationHours.toFixed(1)} h
            {isAnimating && isAnimationPaused
              ? " · paused"
              : isAnimating
                ? " · expanding until goal…"
                : ""}
          </>
        ) : isLoading ? (
          "Building road graph and running algorithms…"
        ) : (
          "Compare Dijkstra, A*, and Greedy Best-First"
        )}
      </div>
    </div>
  );
}
