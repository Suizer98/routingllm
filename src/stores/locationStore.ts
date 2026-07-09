import { create } from "zustand";

import { DEFAULT_END, DEFAULT_START, endpointCoordinate, resolveRouteEndpoints } from "@/lib/geocoding";
import { resetRoadGraphCache } from "@/lib/roadGraph";
import type { RouteEndpoint } from "@/types/location";

type LocationStore = {
  start: RouteEndpoint;
  end: RouteEndpoint;
  isResolving: boolean;
  setStart: (endpoint: RouteEndpoint) => void;
  setEnd: (endpoint: RouteEndpoint) => void;
  setRouteEndpoints: (start: RouteEndpoint, end: RouteEndpoint) => void;
  resolveEndpoints: () => Promise<void>;
  applyGraphCoordinates: (startCoordinate: [number, number], endCoordinate: [number, number]) => void;
};

let endpointMutationChain: Promise<void> = Promise.resolve();
let resolveGeneration = 0;

function enqueueEndpointMutation<T>(work: () => Promise<T>): Promise<T> {
  const run = endpointMutationChain.then(work);
  endpointMutationChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function waitForEndpointMutations(): Promise<void> {
  return endpointMutationChain;
}

function bumpResolveGeneration() {
  resolveGeneration += 1;
  resetRoadGraphCache();
  invalidateActiveRoute();
}

function invalidateActiveRoute() {
  void import("@/stores/routingStore").then(({ useRoutingStore }) => {
    const { route } = useRoutingStore.getState();
    if (!route) {
      return;
    }

    useRoutingStore.setState({
      route: null,
      comparisons: [],
      optimalDistanceKm: null,
      routeProgress: 0,
      pulsePhase: 0,
      isAnimating: false,
      isAnimationPaused: false,
      routeError: null,
    });
  });
}

function withResolvedCoordinate(endpoint: RouteEndpoint, coordinate: [number, number]): RouteEndpoint {
  return {
    ...endpoint,
    resolvedCoordinate: coordinate,
  };
}

export const useLocationStore = create<LocationStore>((set, get) => ({
  start: DEFAULT_START,
  end: DEFAULT_END,
  isResolving: false,
  setStart: (endpoint) => {
    bumpResolveGeneration();
    set({ start: { ...endpoint, id: "start" } });
  },
  setEnd: (endpoint) => {
    bumpResolveGeneration();
    set({ end: { ...endpoint, id: "end" } });
  },
  setRouteEndpoints: (start, end) => {
    bumpResolveGeneration();
    set({
      start: { ...start, id: "start" },
      end: { ...end, id: "end" },
    });
  },
  resolveEndpoints: async () =>
    enqueueEndpointMutation(async () => {
      const generation = resolveGeneration;
      const { start, end } = get();
      set({ isResolving: true });

      try {
        const resolved = await resolveRouteEndpoints(start, end);
        if (generation !== resolveGeneration) {
          return;
        }

        resetRoadGraphCache();
        set({
          start: resolved.start,
          end: resolved.end,
          isResolving: false,
        });
      } catch {
        if (generation === resolveGeneration) {
          set({ isResolving: false });
        }
        throw new Error("Could not resolve route endpoints on the road network");
      }
    }),
  applyGraphCoordinates: (startCoordinate, endCoordinate) => {
    const { start, end } = get();
    set({
      start: withResolvedCoordinate(start, startCoordinate),
      end: withResolvedCoordinate(end, endCoordinate),
    });
  },
}));

export function getResolvedStartCoordinate() {
  return endpointCoordinate(useLocationStore.getState().start);
}

export function getResolvedEndCoordinate() {
  return endpointCoordinate(useLocationStore.getState().end);
}
