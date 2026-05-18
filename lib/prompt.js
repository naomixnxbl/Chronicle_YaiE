import fs from 'fs';
import path from 'path';

// SERVER-ONLY — uses Node's fs module. Only import from app/api/* routes
// or other server code. Importing from a client component will throw.

const FALLBACK_PROMPT =
  'You are Chronicle, the social media content assistant for Western Sydney Tech Innovators (WSTI). Write warm, community-first posts that celebrate Western Sydney. Never sound corporate.';

function loadPrompt() {
  try {
    const promptPath = path.join(process.cwd(), 'PROMPT.md');
    return fs.readFileSync(promptPath, 'utf8').trim();
  } catch {
    return FALLBACK_PROMPT;
  }
}

export const WSTI_SYSTEM_PROMPT = loadPrompt();
