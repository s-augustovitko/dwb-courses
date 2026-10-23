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
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  plugins: [devtools(), solidPlugin()],
});
