import { defineConfig } from "tsup"

export default defineConfig({
  outDir: "lib",
  format: ["cjs", "esm"],
  treeshake: true,
  sourcemap: true,
  dts: true,
  env: {
    ENV_NAME: process.env.ENV_NAME ?? "prod",
  },
  inject: ['./src/inject.ts'],
  noExternal: ['@solana/spl-token']
})
