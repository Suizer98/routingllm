import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import { config } from "@gluestack-ui/config";

import App from "@/App";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GluestackUIProvider config={config}>
      <App />
    </GluestackUIProvider>
  </StrictMode>
);
