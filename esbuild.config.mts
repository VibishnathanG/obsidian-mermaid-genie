import { build, context } from "esbuild";
import process from "node:process";

const watch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/state",
    "@codemirror/view",
    "node:fs/promises",
    "node:path",
    "fs/promises",
    "path"
  ],
  format: "cjs" as const,
  target: "es2022",
  platform: "browser" as const,
  outfile: "main.js",
  sourcemap: false,
  logLevel: "info" as const,
};

if (watch) {
  const ctx = await context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await build(buildOptions);
  console.log("Build complete.");
}
