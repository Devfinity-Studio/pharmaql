import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    bundle: "src/index.ts",
  },
  format: ["cjs"],
  outDir: "dist",
  target: "node20",
  platform: "node",
  clean: true,
  bundle: true,
  minify: true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  outExtension() {
    return {
      js: ".cjs",
    };
  },
  esbuildOptions(options) {
    options.legalComments = "none";
    options.minifyIdentifiers = true;
    options.minifySyntax = true;
    options.minifyWhitespace = true;
  },
  // Externalize any native bindings if required in future
  external: ["*.node"],
  // Bundle all npm modules and internal modules into a single production bundle
  noExternal: [/.*/],
});
