export type RouteEndpointId = "start" | "end";

export type RouteEndpoint = {
  id: RouteEndpointId;
  label: string;
  shortLabel: string;
  query: string;
  coordinate: [number, number];
  resolvedCoordinate: [number, number] | null;
};

export type ResolvedRouteEndpoints = {
  start: RouteEndpoint;
  end: RouteEndpoint;
};
