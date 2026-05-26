import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

function staticPagesAssets() {
  return {
    name: "static-pages-assets",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: ".nojekyll",
        source: fs.readFileSync(".nojekyll", "utf8"),
      });
      this.emitFile({
        type: "asset",
        fileName: "data/aircraft-types.json",
        source: fs.readFileSync("data/aircraft-types.json", "utf8"),
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), staticPagesAssets()],
});
