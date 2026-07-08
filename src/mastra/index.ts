import { Mastra } from "@mastra/core/mastra";

import { routingAgent } from "@/mastra/agents/routing-agent";

export const mastra = new Mastra({
  agents: {
    routingAgent,
  },
});
