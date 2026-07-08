import type { Feature, LineString } from "geojson";

import type {
  RouteComparison,
  RouteResult,
  RoutingAlgorithm,
  RoutingAlgorithmId,
} from "@/types/routing";
import { buildRoadGraph } from "@/lib/roadGraph";
import {
  runAStar,
  runDijkstra,
  runGreedyBestFirst,
} from "@/lib/pathfinding";

export const ROUTING_ALGORITHMS: RoutingAlgorithm[] = [
  {
    id: "dijkstra",
    name: "Dijkstra",
    description: "Uniform-cost search. Optimal, but expands many nodes.",
    color: "#2563eb",
  },
  {
    id: "astar",
    name: "A*",
    description: "Heuristic-guided. Optimal with fewer expansions in debate.",
    color: "#7c3aed",
  },
  {
    id: "greedy-best-first",
    name: "Greedy Best-First",
    description: "Fastest expansion, controversial: not always optimal.",
    color: "#dc2626",
  },
];

const averageDrivingSpeedKmh = 85;

function getAlgorithm(algorithmId: RoutingAlgorithmId) {
  const algorithm = ROUTING_ALGORITHMS.find((item) => item.id === algorithmId);
  if (!algorithm) {
    throw new Error(`Unknown routing algorithm: ${algorithmId}`);
  }
  return algorithm;
}

function toRouteResult(
  algorithmId: RoutingAlgorithmId,
  coordinates: [number, number][],
  distanceKm: number,
  nodesExpanded: number,
  elapsedMs: number,
  guaranteedOptimal: boolean,
): RouteResult {
  const algorithm = getAlgorithm(algorithmId);

  return {
    algorithmId,
    distanceKm,
    durationHours: distanceKm / averageDrivingSpeedKmh,
    nodesExpanded,
    elapsedMs,
    guaranteedOptimal,
    geometry: {
      type: "Feature",
      properties: {
        name: algorithm.name,
        color: algorithm.color,
      },
      geometry: {
        type: "LineString",
        coordinates,
      },
    },
  };
}

function runAlgorithm(algorithmId: RoutingAlgorithmId, graph: Awaited<ReturnType<typeof buildRoadGraph>>) {
  switch (algorithmId) {
    case "dijkstra":
      return runDijkstra(graph);
    case "astar":
      return runAStar(graph);
    case "greedy-best-first":
      return runGreedyBestFirst(graph);
    default:
      return runDijkstra(graph);
  }
}

export async function compareRoutingAlgorithms(): Promise<{
  comparisons: RouteComparison[];
  optimalDistanceKm: number;
}> {
  const graph = await buildRoadGraph();
  const comparisons: RouteComparison[] = [];
  let optimalDistanceKm = Infinity;

  for (const algorithm of ROUTING_ALGORITHMS) {
    const result = runAlgorithm(algorithm.id, graph);
    optimalDistanceKm = Math.min(optimalDistanceKm, result.distanceKm);

    comparisons.push({
      algorithmId: algorithm.id,
      route: toRouteResult(
        algorithm.id,
        result.coordinates,
        result.distanceKm,
        result.nodesExpanded,
        result.elapsedMs,
        result.guaranteedOptimal,
      ),
    });
  }

  return { comparisons, optimalDistanceKm };
}

export async function fetchRoadRoute(
  algorithmId: RoutingAlgorithmId,
): Promise<RouteResult> {
  const { comparisons } = await compareRoutingAlgorithms();
  const match = comparisons.find((item) => item.algorithmId === algorithmId);

  if (!match) {
    throw new Error("Algorithm result not found");
  }

  return match.route;
}

export function sliceLineString(
  geometry: Feature<LineString>,
  progress: number,
): Feature<LineString> {
  const coordinates = geometry.geometry.coordinates as [number, number][];
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const targetCount = Math.max(
    2,
    Math.ceil((coordinates.length - 1) * clampedProgress) + 1,
  );

  return {
    ...geometry,
    geometry: {
      type: "LineString",
      coordinates: coordinates.slice(0, targetCount),
    },
  };
}
