import type { Feature, FeatureCollection, LineString } from "geojson";

import { pathLengthKm } from "@/lib/geo";
import type { RoadGraph } from "@/lib/roadGraph";
import { graphHeuristic, graphNodeCoordinate } from "@/lib/roadGraph";

export type ExpansionEdge = {
  from: [number, number];
  to: [number, number];
  fromId: number;
  toId: number;
  step: number;
  layer: number;
};

export type WavefrontExpansion = {
  expansionEdges: ExpansionEdge[];
  goalReachedStep: number;
  goalReachedLayer: number;
  goalPathSteps: number[];
  goalPathLayers: number[];
};

export type PathfindingResult = {
  path: number[];
  coordinates: [number, number][];
  distanceKm: number;
  nodesExpanded: number;
  elapsedMs: number;
  guaranteedOptimal: boolean;
};

class MinHeap {
  private items: Array<{ priority: number; value: number }> = [];

  push(priority: number, value: number) {
    this.items.push({ priority, value });
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) {
      return undefined;
    }

    const top = this.items[0].value;
    const last = this.items.pop();

    if (this.items.length > 0 && last) {
      this.items[0] = last;
      this.bubbleDown(0);
    }

    return top;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  private bubbleUp(index: number) {
    let current = index;

    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);

      if (this.items[parent].priority <= this.items[current].priority) {
        break;
      }

      [this.items[parent], this.items[current]] = [this.items[current], this.items[parent]];
      current = parent;
    }
  }

  private bubbleDown(index: number) {
    let current = index;

    while (true) {
      const left = current * 2 + 1;
      const right = left + 1;
      let smallest = current;

      if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) {
        smallest = left;
      }

      if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) {
        smallest = right;
      }

      if (smallest === current) {
        break;
      }

      [this.items[current], this.items[smallest]] = [this.items[smallest], this.items[current]];
      current = smallest;
    }
  }
}

function reconstructPath(graph: RoadGraph, previous: Map<number, number>, goalId: number) {
  const path: number[] = [];
  let current: number | undefined = goalId;

  while (current !== undefined) {
    path.unshift(current);
    current = previous.get(current);
  }

  const coordinates = path.map((nodeId) => graphNodeCoordinate(graph, nodeId, graph.startCoordinate));
  return {
    path,
    coordinates,
    distanceKm: pathLengthKm(coordinates),
  };
}

function pushExpansionEdge(expansionEdges: ExpansionEdge[], from: [number, number], to: [number, number], fromId: number, toId: number, layer: number) {
  expansionEdges.push({
    from,
    to,
    fromId,
    toId,
    step: expansionEdges.length,
    layer,
  });
}

function collectGoalPathSteps(expansionEdges: ExpansionEdge[], previous: Map<number, number>, startId: number, goalId: number) {
  const goalPathSteps: number[] = [];
  const goalPathLayers = new Set<number>([0]);
  let node: number | undefined = goalId;

  while (node !== undefined && node !== startId) {
    const parent = previous.get(node);
    if (parent === undefined) {
      break;
    }

    const match = expansionEdges.find((edge) => edge.fromId === parent && edge.toId === node);
    if (match) {
      goalPathSteps.unshift(match.step);
      goalPathLayers.add(match.layer);
    }

    node = parent;
  }

  return {
    goalPathSteps,
    goalPathLayers: [...goalPathLayers],
  };
}

export function buildWavefrontExpansion(graph: RoadGraph): WavefrontExpansion {
  const { startId, goalId, adjacency } = graph;
  const queue: number[] = [startId];
  const visited = new Set<number>([startId]);
  const depth = new Map<number, number>([[startId, 0]]);
  const previous = new Map<number, number>();
  const expansionEdges: ExpansionEdge[] = [];
  let goalReachedStep = -1;
  let goalReachedLayer = 0;
  let goalPathSteps: number[] = [];
  let goalPathLayers: number[] = [0];

  outer: while (queue.length > 0) {
    const current = queue.shift()!;
    const currentCoord = graphNodeCoordinate(graph, current, graph.startCoordinate);
    const currentLayer = depth.get(current) ?? 0;

    for (const edge of adjacency.get(current) ?? []) {
      if (visited.has(edge.to)) {
        continue;
      }

      const layer = currentLayer + 1;
      const toCoord = graphNodeCoordinate(graph, edge.to, graph.startCoordinate);
      visited.add(edge.to);
      depth.set(edge.to, layer);
      previous.set(edge.to, current);
      queue.push(edge.to);
      pushExpansionEdge(expansionEdges, currentCoord, toCoord, current, edge.to, layer);

      if (edge.to === goalId) {
        goalReachedStep = expansionEdges.length - 1;
        goalReachedLayer = layer;
        const goalPath = collectGoalPathSteps(expansionEdges, previous, startId, goalId);
        goalPathSteps = goalPath.goalPathSteps;
        goalPathLayers = goalPath.goalPathLayers;
        break outer;
      }
    }
  }

  if (goalReachedStep < 0 && expansionEdges.length > 0) {
    goalReachedStep = expansionEdges.length - 1;
    goalReachedLayer = expansionEdges[goalReachedStep].layer;
  }

  return {
    expansionEdges,
    goalReachedStep,
    goalReachedLayer,
    goalPathSteps,
    goalPathLayers,
  };
}

export function runDijkstra(graph: RoadGraph): PathfindingResult {
  const startedAt = performance.now();
  const { startId, goalId, adjacency } = graph;
  const distances = new Map<number, number>();
  const previous = new Map<number, number>();
  const settled = new Set<number>();
  const queue = new MinHeap();
  let nodesExpanded = 0;

  distances.set(startId, 0);
  queue.push(0, startId);

  while (!queue.isEmpty()) {
    const current = queue.pop()!;

    if (settled.has(current)) {
      continue;
    }
    settled.add(current);
    nodesExpanded += 1;

    if (current === goalId) {
      break;
    }

    const currentDistance = distances.get(current) ?? Infinity;

    for (const edge of adjacency.get(current) ?? []) {
      if (settled.has(edge.to)) {
        continue;
      }

      const nextDistance = currentDistance + edge.weight;

      if (nextDistance < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, nextDistance);
        previous.set(edge.to, current);
        queue.push(nextDistance, edge.to);
      }
    }
  }

  const route = reconstructPath(graph, previous, goalId);

  return {
    ...route,
    nodesExpanded,
    elapsedMs: performance.now() - startedAt,
    guaranteedOptimal: true,
  };
}

export function runAStar(graph: RoadGraph): PathfindingResult {
  const startedAt = performance.now();
  const { startId, goalId, adjacency } = graph;
  const gScore = new Map<number, number>();
  const previous = new Map<number, number>();
  const settled = new Set<number>();
  const queue = new MinHeap();
  let nodesExpanded = 0;

  gScore.set(startId, 0);
  queue.push(graphHeuristic(graph, startId, goalId), startId);

  while (!queue.isEmpty()) {
    const current = queue.pop()!;

    if (settled.has(current)) {
      continue;
    }
    settled.add(current);
    nodesExpanded += 1;

    if (current === goalId) {
      break;
    }

    const currentG = gScore.get(current) ?? Infinity;

    for (const edge of adjacency.get(current) ?? []) {
      if (settled.has(edge.to)) {
        continue;
      }

      const tentativeG = currentG + edge.weight;

      if (tentativeG < (gScore.get(edge.to) ?? Infinity)) {
        gScore.set(edge.to, tentativeG);
        previous.set(edge.to, current);
        queue.push(tentativeG + graphHeuristic(graph, edge.to, goalId), edge.to);
      }
    }
  }

  const route = reconstructPath(graph, previous, goalId);

  return {
    ...route,
    nodesExpanded,
    elapsedMs: performance.now() - startedAt,
    guaranteedOptimal: true,
  };
}

export function runGreedyBestFirst(graph: RoadGraph): PathfindingResult {
  const startedAt = performance.now();
  const { startId, goalId, adjacency } = graph;
  const previous = new Map<number, number>();
  const settled = new Set<number>();
  const queue = new MinHeap();
  let nodesExpanded = 0;

  queue.push(graphHeuristic(graph, startId, goalId), startId);

  while (!queue.isEmpty()) {
    const current = queue.pop()!;

    if (settled.has(current)) {
      continue;
    }
    settled.add(current);
    nodesExpanded += 1;

    if (current === goalId) {
      break;
    }

    for (const edge of adjacency.get(current) ?? []) {
      if (settled.has(edge.to)) {
        continue;
      }

      if (!previous.has(edge.to)) {
        previous.set(edge.to, current);
      }
      queue.push(graphHeuristic(graph, edge.to, goalId), edge.to);
    }
  }

  const route = reconstructPath(graph, previous, goalId);

  return {
    ...route,
    nodesExpanded,
    elapsedMs: performance.now() - startedAt,
    guaranteedOptimal: false,
  };
}

export function buildExpansionEdgeCollection(edges: ExpansionEdge[], flashByStep: globalThis.Map<number, number> = new globalThis.Map(), maxStep = Infinity): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: edges.map((edge) => ({
      type: "Feature",
      properties: {
        step: edge.step,
        layer: edge.layer,
        flash: edge.step <= maxStep ? (flashByStep.get(edge.step) ?? 0) : 0,
      },
      geometry: {
        type: "LineString",
        coordinates: [edge.from, edge.to],
      },
    })),
  };
}

export function buildSettledFlashMap(edges: ExpansionEdge[], goalPathSteps: number[], offPathFlash = 0.42, onPathFlash = 0.75): globalThis.Map<number, number> {
  const goalPathSet = new Set(goalPathSteps);
  const flashByStep = new globalThis.Map<number, number>();

  flashByStep.set(0, goalPathSet.has(0) ? onPathFlash : offPathFlash);

  for (const edge of edges) {
    const flash = goalPathSet.has(edge.step) ? onPathFlash : offPathFlash;
    flashByStep.set(edge.step, flash);
  }

  return flashByStep;
}

export function buildExpansionNodeCollection(
  edges: ExpansionEdge[],
  origin: [number, number],
  flashByStep: globalThis.Map<number, number> = new globalThis.Map(),
  maxStep = Infinity
): FeatureCollection {
  const seen = new Map<string, number>();
  const features: FeatureCollection["features"] = [
    {
      type: "Feature",
      properties: {
        step: 0,
        layer: 0,
        flash: maxStep >= 0 ? (flashByStep.get(0) ?? 0) : 0,
      },
      geometry: { type: "Point", coordinates: origin },
    },
  ];

  seen.set(`${origin[0].toFixed(5)},${origin[1].toFixed(5)}`, 0);

  for (const edge of edges) {
    for (const coordinate of [edge.from, edge.to]) {
      const key = `${coordinate[0].toFixed(5)},${coordinate[1].toFixed(5)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.set(key, edge.step);

      features.push({
        type: "Feature",
        properties: {
          step: edge.step,
          layer: edge.layer,
          flash: edge.step <= maxStep ? (flashByStep.get(edge.step) ?? 0) : 0,
        },
        geometry: {
          type: "Point",
          coordinates: coordinate,
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

export function sliceLineString(geometry: Feature<LineString>, progress: number): Feature<LineString> {
  const coordinates = geometry.geometry.coordinates as [number, number][];
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const targetCount = Math.max(2, Math.ceil((coordinates.length - 1) * clampedProgress) + 1);

  return {
    ...geometry,
    geometry: {
      type: "LineString",
      coordinates: coordinates.slice(0, targetCount),
    },
  };
}
