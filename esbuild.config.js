import * as esbuild from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";

const watch = process.argv.includes("--watch");
const outdir = "dist";

mkdirSync(outdir, { recursive: true });
mkdirSync(`${outdir}/icons`, { recursive: true });

function copyStaticFiles() {
  copyFileSync("manifest.json", `${outdir}/manifest.json`);
  copyFileSync("src/content/styles.css", `${outdir}/styles.css`);
  for (const size of [16, 48, 128]) {
    copyFileSync(`icons/icon-${size}.png`, `${outdir}/icons/icon-${size}.png`);
  }
}

const contentBuildOptions = {
  entryPoints: ["src/content/index.ts"],
  bundle: true,
  outfile: `${outdir}/content.js`,
  target: "es2020",
  format: "iife",
  sourcemap: true,
};

const backgroundBuildOptions = {
  entryPoints: ["src/background/service-worker.ts"],
  bundle: true,
  outfile: `${outdir}/background.js`,
  target: "es2020",
  format: "iife",
  sourcemap: true,
};

if (watch) {
  const contentCtx = await esbuild.context(contentBuildOptions);
  const backgroundCtx = await esbuild.context(backgroundBuildOptions);
  copyStaticFiles();
  await Promise.all([contentCtx.watch(), backgroundCtx.watch()]);
  console.log("Watching for changes...");
} else {
  await Promise.all([
    esbuild.build(contentBuildOptions),
    esbuild.build(backgroundBuildOptions),
  ]);
  copyStaticFiles();
  console.log("Build complete.");
}
