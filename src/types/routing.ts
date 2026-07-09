import type { Feature, LineString } from "geojson";

import type { ExpansionEdge } from "@/lib/pathfinding";

export type RoutingAlgorithmId = "dijkstra" | "astar" | "greedy-best-first";

export type RoutingAlgorithm = {
  id: RoutingAlgorithmId;
  name: string;
  description: string;
  color: string;
};

export type RouteResult = {
  algorithmId: RoutingAlgorithmId;
  distanceKm: number;
  durationHours: number;
  nodesExpanded: number;
  elapsedMs: number;
  guaranteedOptimal: boolean;
  geometry: Feature<LineString>;
  expansionEdges: ExpansionEdge[];
  goalReachedStep: number;
  goalReachedLayer: number;
  goalPathSteps: number[];
  goalPathLayers: number[];
};

export type RouteComparison = {
  algorithmId: RoutingAlgorithmId;
  route: RouteResult;
};
