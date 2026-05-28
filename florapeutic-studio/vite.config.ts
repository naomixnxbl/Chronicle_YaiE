import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local-only studio. Opens automatically in your browser when you run `npm run dev`.
export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
    port: 5180,
    // Forward "/higgsfield/*" to the Higgsfield API server-side so the browser
    // avoids CORS. Your Bearer key rides along in the request header and is
    // never stored on any server. Active only while `npm run dev` is running.
    proxy: {
      // Local backend (audio→video pipeline).
      "/api": { target: "http://localhost:5181", changeOrigin: true },
      "/generated": { target: "http://localhost:5181", changeOrigin: true },
      "/higgsfield": {
        // Higgsfield Cloud's live API host. (The api.higgsfield.ai host quoted
        // in some third-party blogs does not resolve.) Confirm the exact path
        // for your account at cloud.higgsfield.ai → docs if a call 404s.
        target: "https://platform.higgsfield.ai",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/higgsfield/, ""),
      },
    },
  },
});
