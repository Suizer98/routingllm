import { createGroq } from "@ai-sdk/groq";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import {
  createRouteEndpoint,
  geocodePlace,
  shortLabelFromPlace,
} from "@/lib/geocoding";
import { useLocationStore } from "@/stores/locationStore";
import { useRoutingStore } from "@/stores/routingStore";
import type { RoutingAlgorithmId } from "@/types/routing";

const system = `You control a Southeast Asia route demo on a real road graph.

Tools (only when the user asks for something route-related):
- setRouteEndpoint for start/end places
- selectAlgorithm for dijkstra, astar, or greedy-best-first
- visualizeRoute after changing endpoints or when the user wants to see the route
- getRouteStatus when the user asks about the current route or comparison results

Do not call any tools for greetings, thanks, or small talk. Reply briefly and friendly instead.
When the user asks for a new route, set endpoints then call visualizeRoute.
Keep replies short. Explain algorithm tradeoffs using comparison numbers when available.`;

const routingTools = {
  setRouteEndpoint: tool({
    description: "Set the route start or end to a place name",
    inputSchema: z.object({
      role: z.enum(["start", "end"]),
      place: z.string().describe("City or place name"),
    }),
    execute: async ({ role, place }) => {
      const hit = await geocodePlace(place);
      if (!hit) {
        return { ok: false as const, message: `Could not find "${place}"` };
      }

      const endpoint = createRouteEndpoint(
        role,
        hit.label,
        shortLabelFromPlace(hit.label),
        hit.coordinate,
      );
      const locationStore = useLocationStore.getState();
      if (role === "start") {
        locationStore.setStart(endpoint);
      } else {
        locationStore.setEnd(endpoint);
      }
      await locationStore.resolveEndpoints();

      return { ok: true as const, role, label: hit.label };
    },
  }),
  selectAlgorithm: tool({
    description: "Pick the pathfinding algorithm to visualize",
    inputSchema: z.object({
      algorithm: z.enum(["dijkstra", "astar", "greedy-best-first"]),
    }),
    execute: async ({ algorithm }) => {
      useRoutingStore
        .getState()
        .setSelectedAlgorithm(algorithm as RoutingAlgorithmId);
      return { ok: true as const, algorithm };
    },
  }),
  visualizeRoute: tool({
    description: "Build the road graph, run algorithms, and animate the route",
    inputSchema: z.object({}),
    execute: async () => {
      await useRoutingStore.getState().visualizeRoute();
      const state = useRoutingStore.getState();

      if (state.routeError) {
        return { ok: false as const, error: state.routeError };
      }

      return {
        ok: true as const,
        algorithm: state.selectedAlgorithm,
        comparisons: state.comparisons.map((item) => ({
          algorithm: item.algorithmId,
          distanceKm: Math.round(item.route.distanceKm),
          nodesExpanded: item.route.nodesExpanded,
          elapsedMs: Math.round(item.route.elapsedMs),
          optimal: item.route.guaranteedOptimal,
        })),
        optimalDistanceKm: state.optimalDistanceKm,
      };
    },
  }),
  getRouteStatus: tool({
    description: "Read current endpoints, algorithm, and comparison results",
    inputSchema: z.object({}),
    execute: async () => {
      const { start, end } = useLocationStore.getState();
      const state = useRoutingStore.getState();

      return {
        start: start.label,
        end: end.label,
        algorithm: state.selectedAlgorithm,
        comparisons: state.comparisons.map((item) => ({
          algorithm: item.algorithmId,
          distanceKm: Math.round(item.route.distanceKm),
          nodesExpanded: item.route.nodesExpanded,
          elapsedMs: Math.round(item.route.elapsedMs),
        })),
        optimalDistanceKm: state.optimalDistanceKm,
        isLoading: state.isLoading,
        isAnimating: state.isAnimating,
      };
    },
  }),
};

export async function runRoutingAssistant(prompt: string) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_GROQ_API_KEY");
  }

  const groq = createGroq({ apiKey });
  const result = await generateText({
    model: groq("llama-3.3-70b-versatile"),
    system,
    prompt,
    tools: routingTools,
    stopWhen: stepCountIs(6),
  });

  return result.text.trim() || "Done.";
}
