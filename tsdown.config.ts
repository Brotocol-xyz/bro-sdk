import { defineConfig } from "tsdown"

export default defineConfig({
  // Explicit public entry points (matches the `exports` map in package.json).
  // Everything else is bundled into shared chunks.
  entry: [
    "src/index.ts",
    "src/bitcoinHelpers.ts",
    "src/runesHelpers.ts",
    "src/swapHelpers.ts",
    "src/lowlevelUnstableInfos.ts",
  ],
  outDir: "lib",
  format: ["cjs", "esm"],
  // Keep the published file layout the package's `exports` map already uses:
  // `.js` (cjs) / `.mjs` (esm) / `.d.ts` — instead of tsdown's default
  // `.cjs`/`.d.cts` fixed extensions.
  fixedExtension: false,
  sourcemap: true,
  dts: true,
  treeshake: true,
  // Preserve the previous tsup behavior: bundle @solana/spl-token instead of
  // leaving it external.
  noExternal: ["@solana/spl-token"],
  // @solana/spl-token references the `Buffer` global without importing it (tsup
  // shimmed this via `inject: ['./src/inject.ts']`). rolldown's oxc inject
  // rewrites the free `Buffer` to an import from `buffer`. tsdown deep-merges
  // (defu) this into its own transform options, so target/define/shims survive.
  inputOptions: {
    transform: { inject: { Buffer: ["buffer", "Buffer"] } },
  },
})
