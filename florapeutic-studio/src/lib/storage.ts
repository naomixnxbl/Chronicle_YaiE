import type { ApiKeys, ProjectState } from "./types";

const KEYS_LS = "florapeutic.apiKeys";
const PROJECT_LS = "florapeutic.project";

export const emptyKeys: ApiKeys = { anthropic: "", openai: "", heygen: "", higgsfield: "" };

// Keys are stored on the backend only via .env.local. The browser does not
// load VITE_* secrets directly, so they cannot be leaked in the built app.
const envKeys: ApiKeys = emptyKeys;

// Drop blank values so saved fields don't overwrite anything with empties.
function nonEmpty(obj: ApiKeys): Partial<ApiKeys> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v)) as Partial<ApiKeys>;
}

export function loadKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(KEYS_LS);
    const saved = raw ? (JSON.parse(raw) as ApiKeys) : emptyKeys;
    return { ...emptyKeys, ...nonEmpty(envKeys), ...nonEmpty(saved) };
  } catch {
    return { ...emptyKeys, ...nonEmpty(envKeys) };
  }
}

export function saveKeys(keys: ApiKeys) {
  localStorage.setItem(KEYS_LS, JSON.stringify(keys));
}

// Persist the in-progress project in sessionStorage: it survives a page REFRESH
// but is cleared when the tab/browser is CLOSED — so reopening starts fresh.
// (The object URL and raw audio Blob are per-session and can't be serialised.)
export function saveProject(p: ProjectState) {
  const { audioUrl, audioBlob, ...rest } = p;
  sessionStorage.setItem(PROJECT_LS, JSON.stringify(rest));
}

export function loadProject(): Partial<ProjectState> | null {
  try {
    const raw = sessionStorage.getItem(PROJECT_LS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearProject() {
  sessionStorage.removeItem(PROJECT_LS);
}
