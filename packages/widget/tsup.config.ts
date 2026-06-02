import { defineConfig } from "tsup";
export default defineConfig({
  entry: { index: "src/index.ts", bugnote: "src/index.ts" },
  format: ["esm", "iife"],
  globalName: "BugNote",
  dts: true,
  minify: true,
  clean: true,
  outExtension({ format }) {
    return { js: format === "iife" ? ".umd.js" : ".js" };
  },
});
