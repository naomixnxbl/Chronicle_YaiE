// Tiny .env.local loader (no dependency). Reads VITE_* keys so the backend and
// the browser app share one config file. Server-only — keys never reach the
// client unless the app explicitly sends them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parse(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const fromFiles = { ...parse(path.join(root, ".env")), ...parse(path.join(root, ".env.local")) };
const env = { ...fromFiles, ...process.env };

export const keys = {
  openai: env.VITE_OPENAI_KEY || "",
  anthropic: env.VITE_ANTHROPIC_KEY || "",
  higgsfield: env.VITE_HIGGSFIELD_KEY || "", // "keyid:secret" on the CREDITED account
  heygen: env.VITE_HEYGEN_KEY || "",
};

export const ROOT = root;
