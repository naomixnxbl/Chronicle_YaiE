// Quick smoke test: render a reel from the bundled demo photos, no web form.
// Usage: npm run test-render
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia, ensureBrowser } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const run = async () => {
  console.log("Ensuring headless browser is available (first run downloads it)...");
  await ensureBrowser();

  console.log("Bundling Remotion project...");
  const serveUrl = await bundle({
    entryPoint: path.join(__dirname, "src", "index.ts"),
    publicDir: path.join(__dirname, "public"),
  });

  // Override only the format; everything else uses defaultProps from schema.ts.
  const inputProps = { format: "reels" };

  console.log("Selecting composition (runs calculateMetadata)...");
  const composition = await selectComposition({
    serveUrl,
    id: "WstiReel",
    inputProps,
  });
  console.log(
    `  -> ${composition.width}x${composition.height}, ${composition.durationInFrames} frames @ ${composition.fps}fps (${(
      composition.durationInFrames / composition.fps
    ).toFixed(1)}s)`
  );

  const outputLocation = path.join(__dirname, "out", "test.mp4");
  console.log("Rendering...");
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r  ${(progress * 100).toFixed(0)}%   `);
    },
  });
  console.log(`\nDone -> ${outputLocation}`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
