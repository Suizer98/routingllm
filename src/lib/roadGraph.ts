import type { LineString } from "geojson";

import { endpointCoordinate } from "@/lib/geocoding";
import { haversineKm } from "@/lib/geo";
import type { RouteEndpoint } from "@/types/location";

export type GraphNode = {
  id: number;
  coordinate: [number, number];
  routeId: number;
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
  startCoordinate: [number, number];
  goalCoordinate: [number, number];
};

type OsrmRouteResponse = {
  code: string;
  routes: Array<{
    geometry: LineString;
    distance: number;
  }>;
};

const MALACCA: [number, number] = [102.2501, 2.1896];
const SEREMBAN: [number, number] = [101.9381, 2.7258];

const BATU_PAHAT: [number, number] = [102.9325, 1.8548];
const KUANTAN: [number, number] = [103.332, 3.8077];
const IPOH: [number, number] = [101.0901, 4.5975];

const GRAPH_VERSION = 7;

let cachedGraph: RoadGraph | null = null;
let cachedGraphVersion = 0;
let cachedGraphKey = "";

function formatCoordinate([lng, lat]: [number, number]) {
  return `${lng},${lat}`;
}

async function fetchDrivingRoutes(
  waypoints: [number, number][],
  alternatives: number,
): Promise<[number, number][][]> {
  const coordinates = waypoints.map(formatCoordinate).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false&alternatives=${alternatives}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Road network fetch failed (${response.status})`);
  }

  const data = (await response.json()) as OsrmRouteResponse;
  if (data.code !== "Ok" || data.routes.length === 0) {
    return [];
  }

  return data.routes.map(
    (route) => route.geometry.coordinates as [number, number][],
  );
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

function preserveRouteDetail(
  coordinates: [number, number][],
  maxSpacingKm: number,
  maxPoints: number,
) {
  if (coordinates.length <= 2) {
    return coordinates;
  }

  const detailed: [number, number][] = [coordinates[0]];
  let anchor = coordinates[0];

  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const point = coordinates[index];
    if (haversineKm(anchor, point) >= maxSpacingKm) {
      detailed.push(point);
      anchor = point;
    }
  }

  detailed.push(coordinates[coordinates.length - 1]);

  if (detailed.length > maxPoints) {
    return sampleBackbone(detailed, maxPoints);
  }

  return detailed;
}

function addEdge(
  adjacency: Map<number, GraphEdge[]>,
  from: number,
  to: number,
  weight: number,
) {
  if (from === to) {
    return;
  }

  const edges = adjacency.get(from) ?? [];
  if (edges.some((edge) => edge.to === to)) {
    return;
  }

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

function nearestNodeId(nodes: GraphNode[], target: [number, number]) {
  let bestId = 0;
  let bestDistance = Infinity;

  for (const node of nodes) {
    const distance = haversineKm(node.coordinate, target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = node.id;
    }
  }

  return bestId;
}

function findNearbyNodeIdSameRoute(
  nodes: GraphNode[],
  coordinate: [number, number],
  routeId: number,
  maxDistanceKm: number,
) {
  let bestId: number | null = null;
  let bestDistance = maxDistanceKm;

  for (const node of nodes) {
    if (node.routeId !== routeId) {
      continue;
    }

    const distance = haversineKm(node.coordinate, coordinate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = node.id;
    }
  }

  return bestId;
}

function getOrCreateNode(
  coordinate: [number, number],
  routeId: number,
  nodes: GraphNode[],
  mergeKm = 0.4,
) {
  const existing = findNearbyNodeIdSameRoute(
    nodes,
    coordinate,
    routeId,
    mergeKm,
  );
  if (existing !== null) {
    return existing;
  }

  const id = nodes.length;
  nodes.push({ id, coordinate, routeId });
  return id;
}

function addRouteChain(
  coordinates: [number, number][],
  routeId: number,
  nodes: GraphNode[],
  adjacency: Map<number, GraphEdge[]>,
  spacingKm: number,
  maxPoints: number,
  weightFactor: number,
) {
  const sampled = preserveRouteDetail(coordinates, spacingKm, maxPoints);
  let previousId: number | null = null;

  for (const coordinate of sampled) {
    const nodeId = getOrCreateNode(coordinate, routeId, nodes);

    if (previousId !== null && previousId !== nodeId) {
      const weight =
        haversineKm(nodes[previousId].coordinate, nodes[nodeId].coordinate) *
        weightFactor;
      addBidirectionalEdge(adjacency, previousId, nodeId, weight);
    }

    previousId = nodeId;
  }
}

function nearestAmongNodeIds(
  nodes: GraphNode[],
  nodeIds: number[],
  target: [number, number],
) {
  let bestId = nodeIds[0];
  let bestDistance = haversineKm(nodes[bestId].coordinate, target);

  for (const nodeId of nodeIds) {
    const distance = haversineKm(nodes[nodeId].coordinate, target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = nodeId;
    }
  }

  return bestId;
}

function connectEndpointHub(
  nodes: GraphNode[],
  adjacency: Map<number, GraphEdge[]>,
  target: [number, number],
  radiusKm: number,
) {
  const hubIds = nodes
    .filter((node) => haversineKm(node.coordinate, target) <= radiusKm)
    .map((node) => node.id);

  for (let index = 0; index < hubIds.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < hubIds.length; otherIndex += 1) {
      const weight = haversineKm(
        nodes[hubIds[index]].coordinate,
        nodes[hubIds[otherIndex]].coordinate,
      );
      addBidirectionalEdge(
        adjacency,
        hubIds[index],
        hubIds[otherIndex],
        weight * 1.05,
      );
    }
  }

  if (hubIds.length === 0) {
    return nearestNodeId(nodes, target);
  }

  return nearestAmongNodeIds(nodes, hubIds, target);
}

function connectRouteJunctions(
  nodes: GraphNode[],
  adjacency: Map<number, GraphEdge[]>,
  thresholdKm: number,
) {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];

    for (let otherIndex = index + 1; otherIndex < nodes.length; otherIndex += 1) {
      const other = nodes[otherIndex];
      if (node.routeId === other.routeId) {
        continue;
      }

      const distance = haversineKm(node.coordinate, other.coordinate);
      if (distance <= thresholdKm) {
        addBidirectionalEdge(
          adjacency,
          node.id,
          other.id,
          distance * 1.12,
        );
      }
    }
  }
}

function routeSignature(coordinates: [number, number][]) {
  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];
  const mid = coordinates[Math.floor(coordinates.length / 2)];
  return `${start[0].toFixed(2)},${start[1].toFixed(2)}-${mid[0].toFixed(2)},${mid[1].toFixed(2)}-${end[0].toFixed(2)},${end[1].toFixed(2)}-${coordinates.length}`;
}

async function fetchAllRoadPolylines(
  start: [number, number],
  end: [number, number],
): Promise<[number, number][][]> {
  const queries: Array<{ waypoints: [number, number][]; alternatives: number }> =
    [
      { waypoints: [start, end], alternatives: 3 },
      { waypoints: [start, MALACCA, end], alternatives: 2 },
      { waypoints: [start, SEREMBAN, end], alternatives: 2 },
      { waypoints: [start, BATU_PAHAT, end], alternatives: 1 },
      { waypoints: [start, IPOH, end], alternatives: 1 },
      { waypoints: [start, KUANTAN, end], alternatives: 1 },
    ];

  const results = await Promise.all(
    queries.map((query) =>
      fetchDrivingRoutes(query.waypoints, query.alternatives),
    ),
  );

  const unique: [number, number][][] = [];
  const seen = new Set<string>();

  for (const group of results) {
    for (const route of group) {
      const signature = routeSignature(route);
      if (seen.has(signature)) {
        continue;
      }
      seen.add(signature);
      unique.push(route);
    }
  }

  if (unique.length === 0) {
    throw new Error("Could not load road network for the selected endpoints");
  }

  return unique;
}

function graphCacheKey(start: RouteEndpoint, end: RouteEndpoint) {
  const startCoord = endpointCoordinate(start);
  const endCoord = endpointCoordinate(end);
  return `${startCoord[0].toFixed(4)},${startCoord[1].toFixed(4)}-${endCoord[0].toFixed(4)},${endCoord[1].toFixed(4)}`;
}

async function buildGraphFromRoads(
  start: RouteEndpoint,
  end: RouteEndpoint,
): Promise<RoadGraph> {
  const startCoord = endpointCoordinate(start);
  const endCoord = endpointCoordinate(end);
  const routes = await fetchAllRoadPolylines(startCoord, endCoord);
  const nodes: GraphNode[] = [];
  const adjacency = new Map<number, GraphEdge[]>();

  routes.forEach((route, routeIndex) => {
    addRouteChain(
      route,
      routeIndex,
      nodes,
      adjacency,
      routeIndex === 0 ? 2 : 2.5,
      routeIndex === 0 ? 150 : 90,
      0.92 + (routeIndex % 4) * 0.03,
    );
  });

  connectRouteJunctions(nodes, adjacency, 8);

  const startId = connectEndpointHub(nodes, adjacency, startCoord, 18);
  const goalId = connectEndpointHub(nodes, adjacency, endCoord, 18);

  return {
    nodes,
    adjacency,
    startId,
    goalId,
    startCoordinate: nodes[startId].coordinate,
    goalCoordinate: nodes[goalId].coordinate,
  };
}

export async function buildRoadGraph(
  start: RouteEndpoint,
  end: RouteEndpoint,
): Promise<RoadGraph> {
  const cacheKey = graphCacheKey(start, end);
  if (
    cachedGraph &&
    cachedGraphVersion === GRAPH_VERSION &&
    cachedGraphKey === cacheKey
  ) {
    return cachedGraph;
  }

  cachedGraph = await buildGraphFromRoads(start, end);
  cachedGraphVersion = GRAPH_VERSION;
  cachedGraphKey = cacheKey;
  return cachedGraph;
}

export function graphNodeCoordinate(
  graph: RoadGraph,
  nodeId: number,
  fallback: [number, number],
) {
  return graph.nodes[nodeId]?.coordinate ?? fallback;
}

export function graphHeuristic(graph: RoadGraph, nodeId: number, goalId: number) {
  return haversineKm(
    graph.nodes[nodeId].coordinate,
    graph.nodes[goalId].coordinate,
  );
}

export function resetRoadGraphCache() {
  cachedGraph = null;
  cachedGraphVersion = 0;
  cachedGraphKey = "";
}
