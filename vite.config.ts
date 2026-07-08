import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "react-native": "react-native-web",
    },
    extensions: [
      ".web.tsx",
      ".web.ts",
      ".web.jsx",
      ".web.js",
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
    ],
  },
  optimizeDeps: {
    include: ["react-native-web"],
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
  },
});
