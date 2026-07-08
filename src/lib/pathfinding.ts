import type { RoadGraph } from "@/lib/roadGraph";
import { graphHeuristic, graphNodeCoordinate } from "@/lib/roadGraph";
import { pathLengthKm } from "@/lib/geo";

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

      [this.items[parent], this.items[current]] = [
        this.items[current],
        this.items[parent],
      ];
      current = parent;
    }
  }

  private bubbleDown(index: number) {
    let current = index;

    while (true) {
      const left = current * 2 + 1;
      const right = left + 1;
      let smallest = current;

      if (
        left < this.items.length &&
        this.items[left].priority < this.items[smallest].priority
      ) {
        smallest = left;
      }

      if (
        right < this.items.length &&
        this.items[right].priority < this.items[smallest].priority
      ) {
        smallest = right;
      }

      if (smallest === current) {
        break;
      }

      [this.items[current], this.items[smallest]] = [
        this.items[smallest],
        this.items[current],
      ];
      current = smallest;
    }
  }
}

function reconstructPath(
  graph: RoadGraph,
  previous: Map<number, number>,
  goalId: number,
) {
  const path: number[] = [];
  let current: number | undefined = goalId;

  while (current !== undefined) {
    path.unshift(current);
    current = previous.get(current);
  }

  const coordinates = path.map((nodeId) => graphNodeCoordinate(graph, nodeId));
  return {
    path,
    coordinates,
    distanceKm: pathLengthKm(coordinates),
  };
}

export function runDijkstra(graph: RoadGraph): PathfindingResult {
  const startedAt = performance.now();
  const { startId, goalId, adjacency } = graph;
  const distances = new Map<number, number>();
  const previous = new Map<number, number>();
  const queue = new MinHeap();
  let nodesExpanded = 0;

  distances.set(startId, 0);
  queue.push(0, startId);

  while (!queue.isEmpty()) {
    const current = queue.pop()!;
    const currentDistance = distances.get(current) ?? Infinity;

    if (current !== startId && currentDistance === Infinity) {
      continue;
    }

    nodesExpanded += 1;

    if (current === goalId) {
      break;
    }

    for (const edge of adjacency.get(current) ?? []) {
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
  const queue = new MinHeap();
  let nodesExpanded = 0;

  gScore.set(startId, 0);
  queue.push(graphHeuristic(graph, startId, goalId), startId);

  while (!queue.isEmpty()) {
    const current = queue.pop()!;
    nodesExpanded += 1;

    if (current === goalId) {
      break;
    }

    const currentG = gScore.get(current) ?? Infinity;

    for (const edge of adjacency.get(current) ?? []) {
      const tentativeG = currentG + edge.weight;

      if (tentativeG < (gScore.get(edge.to) ?? Infinity)) {
        gScore.set(edge.to, tentativeG);
        previous.set(edge.to, current);
        queue.push(
          tentativeG + graphHeuristic(graph, edge.to, goalId),
          edge.to,
        );
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
  const visited = new Set<number>();
  const queue = new MinHeap();
  let nodesExpanded = 0;

  queue.push(graphHeuristic(graph, startId, goalId), startId);

  while (!queue.isEmpty()) {
    const current = queue.pop()!;

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);
    nodesExpanded += 1;

    if (current === goalId) {
      break;
    }

    for (const edge of adjacency.get(current) ?? []) {
      if (!visited.has(edge.to)) {
        previous.set(edge.to, current);
        queue.push(graphHeuristic(graph, edge.to, goalId), edge.to);
      }
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
