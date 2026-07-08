import type { Feature, LineString } from "geojson";

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
};

export type RouteComparison = {
  algorithmId: RoutingAlgorithmId;
  route: RouteResult;
};
