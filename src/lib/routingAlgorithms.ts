import type { RouteComparison, RouteResult, RoutingAlgorithm, RoutingAlgorithmId } from "@/types/routing";
import type { ExpansionEdge } from "@/lib/pathfinding";
import { buildRoadGraph } from "@/lib/roadGraph";
import { useLocationStore } from "@/stores/locationStore";
import { buildWavefrontExpansion, runAStar, runDijkstra, runGreedyBestFirst, sliceLineString } from "@/lib/pathfinding";

export { sliceLineString };

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
  expansionEdges: ExpansionEdge[],
  goalReachedStep: number,
  goalReachedLayer: number,
  goalPathSteps: number[],
  goalPathLayers: number[]
): RouteResult {
  const algorithm = getAlgorithm(algorithmId);

  return {
    algorithmId,
    distanceKm,
    durationHours: distanceKm / averageDrivingSpeedKmh,
    nodesExpanded,
    elapsedMs,
    guaranteedOptimal,
    expansionEdges,
    goalReachedStep,
    goalReachedLayer,
    goalPathSteps,
    goalPathLayers,
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
  const locationState = useLocationStore.getState();
  await locationState.resolveEndpoints();

  const { start, end, applyGraphCoordinates } = useLocationStore.getState();
  const graph = await buildRoadGraph(start, end);
  applyGraphCoordinates(graph.startCoordinate, graph.goalCoordinate);

  const wavefront = buildWavefrontExpansion(graph);
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
        wavefront.expansionEdges,
        wavefront.goalReachedStep,
        wavefront.goalReachedLayer,
        wavefront.goalPathSteps,
        wavefront.goalPathLayers
      ),
    });
  }

  return { comparisons, optimalDistanceKm };
}

export async function fetchRoadRoute(algorithmId: RoutingAlgorithmId): Promise<RouteResult> {
  const { comparisons } = await compareRoutingAlgorithms();
  const match = comparisons.find((item) => item.algorithmId === algorithmId);

  if (!match) {
    throw new Error("Algorithm result not found");
  }

  return match.route;
}
