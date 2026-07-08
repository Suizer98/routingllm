import type { LineString } from "geojson";

import { KUALA_LUMPUR, SINGAPORE } from "@/lib/constants";
import { bearingRadians, haversineKm, offsetPoint } from "@/lib/geo";

export type GraphNode = {
  id: number;
  coordinate: [number, number];
  lane: "express" | "coastal" | "inland";
};

export type GraphEdge = {
  to: number;
  weight: number;
};

export type RoadGraph = {
  nodes: GraphNode[];
  adjacency: Map<number, GraphEdge[]>;
  startId: number;
  goalId: number;
};

type OsrmRouteResponse = {
  code: string;
  routes: Array<{
    geometry: LineString;
  }>;
};

let cachedGraph: RoadGraph | null = null;

function formatCoordinate([lng, lat]: [number, number]) {
  return `${lng},${lat}`;
}

async function fetchDrivingBackbone(): Promise<[number, number][]> {
  const coordinates = [SINGAPORE, KUALA_LUMPUR].map(formatCoordinate).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Road network fetch failed (${response.status})`);
  }

  const data = (await response.json()) as OsrmRouteResponse;
  if (data.code !== "Ok" || !data.routes[0]) {
    throw new Error("Could not load road network between Singapore and Kuala Lumpur");
  }

  return data.routes[0].geometry.coordinates as [number, number][];
}

function sampleBackbone(coordinates: [number, number][], targetCount: number) {
  if (coordinates.length <= targetCount) {
    return coordinates;
  }

  const sampled: [number, number][] = [];
  const step = (coordinates.length - 1) / (targetCount - 1);

  for (let index = 0; index < targetCount; index += 1) {
    sampled.push(coordinates[Math.round(index * step)]);
  }

  return sampled;
}

function addEdge(
  adjacency: Map<number, GraphEdge[]>,
  from: number,
  to: number,
  weight: number,
) {
  const edges = adjacency.get(from) ?? [];
  edges.push({ to, weight });
  adjacency.set(from, edges);
}

function addBidirectionalEdge(
  adjacency: Map<number, GraphEdge[]>,
  from: number,
  to: number,
  weight: number,
) {
  addEdge(adjacency, from, to, weight);
  addEdge(adjacency, to, from, weight);
}

export async function buildRoadGraph(): Promise<RoadGraph> {
  if (cachedGraph) {
    return cachedGraph;
  }

  const backbone = sampleBackbone(await fetchDrivingBackbone(), 28);
  const nodes: GraphNode[] = [];
  const adjacency = new Map<number, GraphEdge[]>();
  const laneOffsetsKm = {
    express: 0,
    coastal: 18,
    inland: -22,
  } as const;

  for (let index = 0; index < backbone.length; index += 1) {
    const current = backbone[index];
    const next = backbone[Math.min(index + 1, backbone.length - 1)];
    const previous = backbone[Math.max(index - 1, 0)];
    const segmentBearing = bearingRadians(previous, next);
    const coastalBearing = segmentBearing + Math.PI / 2;
    const inlandBearing = segmentBearing - Math.PI / 2;

    const expressId = nodes.length;
    nodes.push({
      id: expressId,
      coordinate: current,
      lane: "express",
    });

    const coastalId = nodes.length;
    nodes.push({
      id: coastalId,
      coordinate: offsetPoint(current, coastalBearing, laneOffsetsKm.coastal),
      lane: "coastal",
    });

    const inlandId = nodes.length;
    nodes.push({
      id: inlandId,
      coordinate: offsetPoint(current, inlandBearing, laneOffsetsKm.inland),
      lane: "inland",
    });

    if (index > 0) {
      const previousExpress = expressId - 3;
      const previousCoastal = coastalId - 3;
      const previousInland = inlandId - 3;

      addEdge(
        adjacency,
        previousExpress,
        expressId,
        haversineKm(nodes[previousExpress].coordinate, nodes[expressId].coordinate) *
          0.92,
      );
      addEdge(
        adjacency,
        previousCoastal,
        coastalId,
        haversineKm(nodes[previousCoastal].coordinate, nodes[coastalId].coordinate) *
          1.08,
      );
      addEdge(
        adjacency,
        previousInland,
        inlandId,
        haversineKm(nodes[previousInland].coordinate, nodes[inlandId].coordinate) *
          1.12,
      );

      if (index % 4 === 0) {
        addBidirectionalEdge(
          adjacency,
          expressId,
          coastalId,
          haversineKm(nodes[expressId].coordinate, nodes[coastalId].coordinate) *
            1.15,
        );
        addBidirectionalEdge(
          adjacency,
          expressId,
          inlandId,
          haversineKm(nodes[expressId].coordinate, nodes[inlandId].coordinate) *
            1.18,
        );
        addBidirectionalEdge(
          adjacency,
          coastalId,
          inlandId,
          haversineKm(nodes[coastalId].coordinate, nodes[inlandId].coordinate) *
            1.2,
        );
      }
    }
  }

  const startId = 0;
  const goalId = nodes.length - 3;

  cachedGraph = { nodes, adjacency, startId, goalId };
  return cachedGraph;
}

export function graphNodeCoordinate(graph: RoadGraph, nodeId: number) {
  return graph.nodes[nodeId]?.coordinate ?? SINGAPORE;
}

export function graphHeuristic(graph: RoadGraph, nodeId: number, goalId: number) {
  return haversineKm(
    graph.nodes[nodeId].coordinate,
    graph.nodes[goalId].coordinate,
  );
}
