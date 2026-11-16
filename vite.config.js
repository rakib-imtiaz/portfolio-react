import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 900,
    // three.js changes less often than the story, so it gets its own file for the browser cache
    rollupOptions: { output: { manualChunks: (id) => (id.includes("node_modules/three/") ? "three" : id.includes("node_modules/react") ? "react" : undefined) } },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4610, strictPort: true },
});
