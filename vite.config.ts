import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// No dev proxy on purpose. Translation reads are anonymous and the service sends CORS
// headers, so the browser talks to the API directly in dev exactly as it does in
// production — the setup under demonstration is the one that actually runs.
export default defineConfig({
  plugins: [react()],
});
