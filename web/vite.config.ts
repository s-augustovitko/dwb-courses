import path from "node:path";
import devtools from "solid-devtools/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  // The devtools plugin injects this import, so the startup scan misses it and Vite re-optimizes mid-session.
  optimizeDeps: {
    include: ["solid-devtools/setup"],
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  plugins: [devtools(), solidPlugin()],
});
