import { createGroq } from "@ai-sdk/groq";
import { Agent } from "@mastra/core/agent";

const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;

const groq = createGroq({
  apiKey: groqApiKey,
});

export const routingAgent = new Agent({
  id: "routing-agent",
  name: "Routing Assistant",
  instructions: "You are a helpful routing assistant for Southeast Asia. Explain routes, distances, and travel options clearly and concisely.",
  model: groq("llama-3.3-70b-versatile"),
});
