import { build, context } from "esbuild";
import process from "node:process";
import fs from "node:fs/promises";
import path from "node:path";

const watch = process.argv.includes("--watch");

async function copyToDist() {
  await fs.mkdir("dist", { recursive: true });
  for (const file of ["main.js", "manifest.json", "styles.css"]) {
    try {
      await fs.copyFile(file, path.join("dist", file));
    } catch (err) {
      console.warn(`Could not copy ${file} to dist:`, err);
    }
  }
}

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
  const ctx = await context({
    ...buildOptions,
    plugins: [
      {
        name: "copy-dist",
        setup(build) {
          build.onEnd(() => copyToDist());
        },
      },
    ],
  });
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await build(buildOptions);
  await copyToDist();
  console.log("Build complete.");
}
