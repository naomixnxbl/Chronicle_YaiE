// Delete old render artifacts so the disk doesn't fill up over time.
// Removes per-render upload folders (public/uploads/*) and finished videos
// (out/*) older than a cutoff. Safe to run anytime — recent files (an
// in-progress or just-finished render) are kept.
//
// Usage:  node tools/cleanup.mjs            (default: older than 48h)
//         node tools/cleanup.mjs --hours 24
//         node tools/cleanup.mjs --hours 0  (clear everything)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const arg = process.argv.indexOf("--hours");
const HOURS = arg !== -1 ? Number(process.argv[arg + 1]) : 48;
const cutoff = Date.now() - HOURS * 3600 * 1000;

const TARGETS = [
  { dir: path.join(ROOT, "public", "uploads"), label: "uploads" },
  { dir: path.join(ROOT, "out"), label: "out" },
];

let removed = 0;
let freedBytes = 0;

function sizeOf(p) {
  try {
    const st = fs.statSync(p);
    if (st.isFile()) return st.size;
    let total = 0;
    for (const e of fs.readdirSync(p)) total += sizeOf(path.join(p, e));
    return total;
  } catch {
    return 0;
  }
}

for (const { dir, label } of TARGETS) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue; // keep .gitkeep etc.
    const full = path.join(dir, name);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (st.mtimeMs >= cutoff) continue; // too recent — keep
    const bytes = sizeOf(full);
    try {
      fs.rmSync(full, { recursive: true, force: true });
      removed++;
      freedBytes += bytes;
      console.log(`  removed ${label}/${name}`);
    } catch (e) {
      console.log(`  could not remove ${label}/${name}: ${e.message}`);
    }
  }
}

const mb = (freedBytes / 1024 / 1024).toFixed(1);
console.log(removed
  ? `Cleanup: removed ${removed} item(s), freed ~${mb} MB (older than ${HOURS}h).`
  : `Cleanup: nothing older than ${HOURS}h to remove.`);
