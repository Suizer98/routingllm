import { useEffect, useMemo, useRef } from "react";
import { Box, Text } from "@gluestack-ui/themed";
import { Layer, Map, Source } from "@vis.gl/react-maplibre";
import type { FeatureCollection } from "geojson";
import { LngLatBounds } from "maplibre-gl";
import type { MapRef } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  END_LAYER_ID,
  END_SOURCE_ID,
  KUALA_LUMPUR,
  MAP_STYLE,
  PULSE_LAYER_ID,
  PULSE_SOURCE_ID,
  ROUTE_LAYER_ID,
  ROUTE_SOURCE_ID,
  SINGAPORE,
  START_LAYER_ID,
  START_SOURCE_ID,
} from "@/lib/constants";
import { sliceLineString } from "@/lib/routingAlgorithms";
import { useLayerStore } from "@/stores/layerStore";
import { useRoutingStore } from "@/stores/routingStore";

const initialViewState = {
  longitude: (SINGAPORE[0] + KUALA_LUMPUR[0]) / 2,
  latitude: (SINGAPORE[1] + KUALA_LUMPUR[1]) / 2,
  zoom: 6.2,
};

function createPulseFeatures(pulsePhase: number): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [0, 1, 2].map((ring) => {
      const offset = ring * 0.34;
      const localPhase = (pulsePhase + offset) % 1;

      return {
        type: "Feature",
        properties: {
          radius: 10 + localPhase * 42,
          opacity: Math.max(0, 0.65 * (1 - localPhase)),
        },
        geometry: {
          type: "Point",
          coordinates: SINGAPORE,
        },
      };
    }),
  };
}

export function RouteMap() {
  const mapRef = useRef<MapRef>(null);
  const layers = useLayerStore((state) => state.layers);
  const route = useRoutingStore((state) => state.route);
  const routeError = useRoutingStore((state) => state.routeError);
  const isLoading = useRoutingStore((state) => state.isLoading);
  const routeProgress = useRoutingStore((state) => state.routeProgress);
  const pulsePhase = useRoutingStore((state) => state.pulsePhase);
  const isAnimating = useRoutingStore((state) => state.isAnimating);
  const animationToken = useRoutingStore((state) => state.animationToken);
  const setAnimationFrame = useRoutingStore((state) => state.setAnimationFrame);
  const finishAnimation = useRoutingStore((state) => state.finishAnimation);

  const visibility = useMemo(() => {
    return layers.reduce<Record<string, "visible" | "none">>((acc, layer) => {
      const visibilityValue = layer.visible ? "visible" : "none";
      for (const mapLayerId of layer.mapLayerIds) {
        acc[mapLayerId] = visibilityValue;
      }
      return acc;
    }, {});
  }, [layers]);

  useEffect(() => {
    if (!isAnimating) {
      return;
    }

    const token = animationToken;
    const startedAt = performance.now();
    const durationMs = 2400;
    let frameId = 0;

    const tick = (timestamp: number) => {
      if (useRoutingStore.getState().animationToken !== token) {
        return;
      }

      const elapsed = timestamp - startedAt;
      const rawProgress = Math.min(elapsed / durationMs, 1);
      const easedProgress = 1 - (1 - rawProgress) ** 3;
      const nextPulsePhase = (elapsed % 700) / 700;

      setAnimationFrame(easedProgress, nextPulsePhase);

      if (rawProgress < 1) {
        frameId = requestAnimationFrame(tick);
        return;
      }

      finishAnimation();
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [
    animationToken,
    finishAnimation,
    isAnimating,
    setAnimationFrame,
  ]);

  useEffect(() => {
    if (!route || isAnimating) {
      return;
    }

    const map = mapRef.current?.getMap();
    const coordinates = route.geometry.geometry.coordinates as [number, number][];

    if (!map || coordinates.length < 2) {
      return;
    }

    const bounds = coordinates.reduce((nextBounds, coordinate) => {
      return nextBounds.extend(coordinate);
    }, new LngLatBounds(coordinates[0], coordinates[0]));

    map.fitBounds(bounds, {
      padding: { top: 80, right: 80, bottom: 80, left: 360 },
      duration: 900,
    });
  }, [isAnimating, route]);

  const displayedRoute = useMemo(() => {
    if (!route) {
      return null;
    }

    if (isAnimating) {
      return sliceLineString(route.geometry, routeProgress);
    }

    return route.geometry;
  }, [isAnimating, route, routeProgress]);

  const routeColor =
    (route?.geometry.properties?.color as string | undefined) ?? "#2563eb";
  const pulseData = useMemo(
    () => createPulseFeatures(isAnimating ? pulsePhase : 0),
    [isAnimating, pulsePhase],
  );

  const startVisible = visibility[START_LAYER_ID] ?? "visible";
  const endVisible = visibility[END_LAYER_ID] ?? "visible";
  const routeVisible = visibility[ROUTE_LAYER_ID] ?? "visible";
  const showPulse = Boolean(route && isAnimating);

  return (
    <div className="map-shell">
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
      >
        {displayedRoute ? (
          <Source id={ROUTE_SOURCE_ID} type="geojson" data={displayedRoute}>
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
                "line-width": 10,
                "line-opacity": 0.22,
                "line-blur": 4,
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
                "line-width": 4,
                "line-opacity": isAnimating ? 0.88 : 1,
              }}
            />
          </Source>
        ) : null}

        {showPulse ? (
          <Source id={PULSE_SOURCE_ID} type="geojson" data={pulseData}>
            <Layer
              id={PULSE_LAYER_ID}
              type="circle"
              paint={{
                "circle-radius": ["get", "radius"],
                "circle-color": routeColor,
                "circle-opacity": ["get", "opacity"],
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1,
                "circle-stroke-opacity": ["get", "opacity"],
              }}
            />
          </Source>
        ) : null}

        <Source
          id={START_SOURCE_ID}
          type="geojson"
          data={{
            type: "Feature",
            properties: { name: "Singapore" },
            geometry: { type: "Point", coordinates: SINGAPORE },
          }}
        >
          <Layer
            id={START_LAYER_ID}
            type="circle"
            layout={{ visibility: startVisible }}
            paint={{
              "circle-radius": isAnimating ? 10 : 8,
              "circle-color": "#16a34a",
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
              "circle-opacity": isAnimating ? 0.95 : 1,
            }}
          />
        </Source>

        <Source
          id={END_SOURCE_ID}
          type="geojson"
          data={{
            type: "Feature",
            properties: { name: "Kuala Lumpur" },
            geometry: { type: "Point", coordinates: KUALA_LUMPUR },
          }}
        >
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

      <Box
        position="absolute"
        top="$4"
        right="$4"
        zIndex={1}
        px="$3"
        py="$2"
        borderRadius="$md"
        bg="rgba(255, 255, 255, 0.92)"
        borderWidth={1}
        borderColor="$borderLight200"
        sx={{
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
        }}
      >
        {routeError ? (
          <Text size="sm" color="$error600">
            {routeError}
          </Text>
        ) : route ? (
          <Text size="sm">
            {(route.geometry.properties?.name as string) ?? "Route"} ·{" "}
            {route.distanceKm.toFixed(0)} km · {route.durationHours.toFixed(1)} h
          </Text>
        ) : isLoading ? (
          <Text size="sm">Building road graph and running algorithms…</Text>
        ) : (
          <Text size="sm">Compare Dijkstra, A*, and Greedy Best-First</Text>
        )}
      </Box>
    </div>
  );
}
