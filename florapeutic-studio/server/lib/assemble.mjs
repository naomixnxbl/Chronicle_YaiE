// Appends the signature Florapeutic brand outro to any finished video:
// a butterfly glides from the bottom-left corner to the top-right while
// "Florapeutic" + the flower bloom in the centre. Same on every video.
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FF = "/opt/homebrew/bin/ffmpeg";
const FFPROBE = "/opt/homebrew/bin/ffprobe";
const PY = "python3";
const BRANDPY = path.join(here, "brand.py");

const run = (cmd, args) =>
  new Promise((res, rej) =>
    execFile(cmd, args, { maxBuffer: 1 << 27 }, (e, so, se) => (e ? rej(new Error((se || e.message).slice(-700))) : res(so)))
  );

async function probeDims(file) {
  const out = await run(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file]);
  const [w, h] = out.trim().split("x").map(Number);
  return { w: w || 1280, h: h || 720 };
}

// Build the ~3.8s brand outro at the given dimensions.
async function makeBrandOutro(dir, w, h) {
  await run(PY, [BRANDPY, dir, String(w), String(h)]);
  const T = 3.4, total = 3.8;
  const bSize = Math.round(Math.min(w, h) * 0.18);
  const out = path.join(dir, "outro.mp4");
  await run(FF, [
    "-y",
    "-loop", "1", "-t", String(total), "-i", path.join(dir, "outrobg.png"),
    "-loop", "1", "-t", String(total), "-i", path.join(dir, "butterfly.png"),
    "-loop", "1", "-t", String(total), "-i", path.join(dir, "wordmark.png"),
    "-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=44100:cl=stereo",
    "-filter_complex",
    `[0:v]scale=${w}:${h},fps=24,format=yuv420p[bg];` +
    `[1:v]scale=${bSize}:-1[bf];` +
    `[2:v]format=rgba,fade=t=in:st=1.2:d=0.7:alpha=1[wm];` +
    `[bg][bf]overlay=x='-w+(W+w)*(t/${T})':y='H*0.80-(H*0.64)*(t/${T})+0.04*H*sin(4*t)':eval=frame[o1];` +
    `[o1][wm]overlay=0:0,fade=t=in:st=0:d=0.4,fade=t=out:st=${(total - 0.5).toFixed(2)}:d=0.5[v]`,
    "-map", "[v]", "-map", "3:a",
    "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", "24",
    "-c:a", "aac", "-b:a", "160k", "-shortest", out,
  ]);
  return out;
}

// Append the brand outro to a finished video. Returns the branded mp4 path.
export async function brandify(dir, inMp4) {
  const { w, h } = await probeDims(inMp4);
  const outro = await makeBrandOutro(dir, w, h);
  const out = path.join(dir, "branded.mp4");
  await run(FF, [
    "-y", "-i", inMp4, "-i", outro,
    "-filter_complex",
    `[0:v]scale=${w}:${h},fps=24,setsar=1[v0];[1:v]scale=${w}:${h},fps=24,setsar=1[v1];` +
    `[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];[1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1];` +
    `[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]`,
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out,
  ]);
  return out;
}
