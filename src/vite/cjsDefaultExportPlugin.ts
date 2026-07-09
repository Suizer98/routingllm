import type { Plugin } from "vite";

const cjsInteropPackages = ["inline-style-prefixer", "css-in-js-utils", "hyphenate-style-name", "fbjs", "react-native-svg"];

function appendNamedExports(code: string) {
  if (!code.includes("const __cjsExport =")) {
    return code;
  }

  const keys = ["parse", "stringify", "extract", "props2transform"];
  const namedExports = keys
    .filter((key) => code.includes(`${key}:`) || code.includes(`${key}(`))
    .map((key) => `export const ${key} = __cjsExport.${key};`)
    .join("\n");

  if (!namedExports) {
    return `${code}\nexport default __cjsExport;`;
  }

  return `${code}\nexport default __cjsExport;\n${namedExports}`;
}

export function cjsDefaultExportPlugin(): Plugin {
  return {
    name: "cjs-default-export",
    transform(code, id) {
      if (!id.includes("node_modules")) {
        return null;
      }

      if (!cjsInteropPackages.some((pkg) => id.includes(pkg))) {
        return null;
      }

      if (!/module\.exports\s*=/.test(code)) {
        return null;
      }

      if (code.includes("export default")) {
        return null;
      }

      const updated = code.replace(/module\.exports\s*=\s*/, "const __cjsExport = ");

      return {
        code: appendNamedExports(updated),
        map: null,
      };
    },
  };
}
