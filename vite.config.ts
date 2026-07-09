import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import checker from "vite-plugin-checker";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cjsDefaultExportPlugin } from "./src/vite/cjsDefaultExportPlugin";

const root = path.dirname(fileURLToPath(import.meta.url));
const reactNativeWeb = path.resolve(root, "node_modules/react-native-web");
const codegenNativeComponentShim = path.resolve(root, "src/shims/codegenNativeComponent.ts");
const assetsRegistryShim = path.resolve(root, "src/shims/assetsRegistry.ts");
const normalizeCssColorShim = path.resolve(root, "src/shims/normalizeCssColor.ts");
const svgTransformShim = path.resolve(root, "src/shims/svgTransform.ts");

const webAliases = {
  "react-native": reactNativeWeb,
  "react-native/Libraries/Utilities/codegenNativeComponent": codegenNativeComponentShim,
  "@react-native/assets-registry/registry": assetsRegistryShim,
  "normalize-css-color": normalizeCssColorShim,
  "normalize-css-color/index.js": normalizeCssColorShim,
  "react-native-svg/lib/module/lib/extract/transform": svgTransformShim,
  "react-native-svg/lib/module/lib/extract/transform.js": svgTransformShim,
};

export default defineConfig({
  plugins: [
    react(),
    checker({
      typescript: {
        tsconfigPath: "tsconfig.json",
        buildMode: true,
      },
      overlay: {
        initialIsOpen: false,
      },
    }),
    cjsDefaultExportPlugin(),
    tailwindcss(),
  ],
  define: {
    "__DEV__": JSON.stringify(process.env.NODE_ENV !== "production"),
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
  },
  resolve: {
    alias: [
      {
        find: /react-native-svg\/lib\/module\/lib\/extract\/transform(\.js)?$/,
        replacement: svgTransformShim,
      },
      {
        find: /^normalize-css-color(\/index\.js)?$/,
        replacement: normalizeCssColorShim,
      },
      {
        find: "@react-native/assets-registry/registry",
        replacement: assetsRegistryShim,
      },
      {
        find: "react-native/Libraries/Utilities/codegenNativeComponent",
        replacement: codegenNativeComponentShim,
      },
      {
        find: /^react-native$/,
        replacement: reactNativeWeb,
      },
      {
        find: "@",
        replacement: path.resolve(root, "src"),
      },
    ],
    extensions: [".web.tsx", ".web.ts", ".web.jsx", ".web.js", ".tsx", ".ts", ".jsx", ".js"],
  },
  optimizeDeps: {
    include: ["react-native-web", "@gluestack-ui/themed", "@gluestack-ui/config", "@gluestack-style/react", "inline-style-prefixer", "react-native-svg"],
    needsInterop: ["inline-style-prefixer", "normalize-css-color", "react-native-svg"],
    esbuildOptions: {
      define: {
        __DEV__: "true",
      },
      resolveExtensions: [".web.js", ".web.jsx", ".web.ts", ".web.tsx", ".js", ".jsx", ".ts", ".tsx"],
      alias: webAliases,
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
  },
});
