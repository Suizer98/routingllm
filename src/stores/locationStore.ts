import { create } from "zustand";

import {
  DEFAULT_END,
  DEFAULT_START,
  endpointCoordinate,
  resolveRouteEndpoints,
} from "@/lib/geocoding";
import { resetRoadGraphCache } from "@/lib/roadGraph";
import type { RouteEndpoint } from "@/types/location";

type LocationStore = {
  start: RouteEndpoint;
  end: RouteEndpoint;
  isResolving: boolean;
  setStart: (endpoint: RouteEndpoint) => void;
  setEnd: (endpoint: RouteEndpoint) => void;
  resolveEndpoints: () => Promise<void>;
  applyGraphCoordinates: (
    startCoordinate: [number, number],
    endCoordinate: [number, number],
  ) => void;
};

function withResolvedCoordinate(
  endpoint: RouteEndpoint,
  coordinate: [number, number],
): RouteEndpoint {
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
    resetRoadGraphCache();
    set({ start: { ...endpoint, id: "start" } });
  },
  setEnd: (endpoint) => {
    resetRoadGraphCache();
    set({ end: { ...endpoint, id: "end" } });
  },
  resolveEndpoints: async () => {
    const { start, end } = get();
    set({ isResolving: true });

    try {
      const resolved = await resolveRouteEndpoints(start, end);
      resetRoadGraphCache();
      set({
        start: resolved.start,
        end: resolved.end,
        isResolving: false,
      });
    } catch {
      set({ isResolving: false });
      throw new Error("Could not resolve route endpoints on the road network");
    }
  },
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
