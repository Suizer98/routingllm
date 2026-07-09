import { create } from "zustand";

import {
  compareRoutingAlgorithms,
  ROUTING_ALGORITHMS,
} from "@/lib/routingAlgorithms";
import { waitForEndpointMutations } from "@/stores/locationStore";
import type {
  RouteComparison,
  RouteResult,
  RoutingAlgorithmId,
} from "@/types/routing";

type RoutingStore = {
  selectedAlgorithm: RoutingAlgorithmId;
  route: RouteResult | null;
  comparisons: RouteComparison[];
  optimalDistanceKm: number | null;
  routeProgress: number;
  pulsePhase: number;
  isAnimating: boolean;
  isAnimationPaused: boolean;
  isLoading: boolean;
  routeError: string | null;
  animationToken: number;
  setSelectedAlgorithm: (algorithmId: RoutingAlgorithmId) => void;
  visualizeRoute: () => Promise<void>;
  pauseAnimation: () => void;
  resumeAnimation: () => void;
  setAnimationFrame: (routeProgress: number, pulsePhase: number) => void;
  finishAnimation: () => void;
};

export const useRoutingStore = create<RoutingStore>((set, get) => ({
  selectedAlgorithm: "dijkstra",
  route: null,
  comparisons: [],
  optimalDistanceKm: null,
  routeProgress: 0,
  pulsePhase: 0,
  isAnimating: false,
  isAnimationPaused: false,
  isLoading: false,
  routeError: null,
  animationToken: 0,
  setSelectedAlgorithm: (algorithmId) => {
    const { comparisons, animationToken } = get();
    const selected = comparisons.find((item) => item.algorithmId === algorithmId);

    if (selected) {
      set({
        selectedAlgorithm: algorithmId,
        routeError: null,
        route: selected.route,
        routeProgress: 0,
        pulsePhase: 0,
        isAnimating: true,
        isAnimationPaused: false,
        animationToken: animationToken + 1,
      });
      return;
    }

    set({
      selectedAlgorithm: algorithmId,
      routeError: null,
      route: null,
    });
  },
  visualizeRoute: async () => {
    const { selectedAlgorithm, animationToken, isAnimating, isLoading } = get();

    if (isAnimating || isLoading) {
      return;
    }

    set({
      isLoading: true,
      routeError: null,
    });

    try {
      await waitForEndpointMutations();
      const { comparisons, optimalDistanceKm } = await compareRoutingAlgorithms();
      const selected = comparisons.find(
        (item) => item.algorithmId === selectedAlgorithm,
      );

      if (!selected) {
        throw new Error("Algorithm result not found");
      }

      set({
        comparisons,
        optimalDistanceKm,
        route: selected.route,
        routeProgress: 0,
        pulsePhase: 0,
        isAnimating: true,
        isAnimationPaused: false,
        isLoading: false,
        animationToken: animationToken + 1,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to calculate route";

      set({
        isLoading: false,
        routeError: message,
      });
    }
  },
  pauseAnimation: () => {
    const { isAnimating, isAnimationPaused } = get();
    if (isAnimating && !isAnimationPaused) {
      set({ isAnimationPaused: true });
    }
  },
  resumeAnimation: () => {
    const { isAnimating, isAnimationPaused } = get();
    if (isAnimating && isAnimationPaused) {
      set({ isAnimationPaused: false });
    }
  },
  setAnimationFrame: (routeProgress, pulsePhase) =>
    set({ routeProgress, pulsePhase }),
  finishAnimation: () =>
    set({
      isAnimating: false,
      isAnimationPaused: false,
      routeProgress: 1,
      pulsePhase: 0,
    }),
}));

export function getAlgorithmLabel(algorithmId: RoutingAlgorithmId) {
  return (
    ROUTING_ALGORITHMS.find((algorithm) => algorithm.id === algorithmId)?.name ??
    algorithmId
  );
}
