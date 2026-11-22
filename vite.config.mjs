import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, readFileSync, writeFileSync } from "node:fs";

// The art folder at the root is the one source for images: the app asks for
// "art/..." at run time, and the UI kit links to it too. Copy it into the build
// as-is, and give the service worker a fresh cache name on every build so phones
// pick up the new version without anyone bumping a number by hand.
const shipArt = () => ({
  name: "may-i-ship-art",
  apply: "build",
  closeBundle() {
    cpSync("art", "dist/art", { recursive: true, filter: p => !/(\.DS_Store|_preview)/.test(p) });
    const sw = "dist/sw.js";
    writeFileSync(sw, readFileSync(sw, "utf8").replace(/const CACHE = "[^"]*";/, `const CACHE = "mayi-${Date.now().toString(36)}";`));
  },
});

export default defineConfig({
  base: "./",
  plugins: [react(), shipArt()],
  build: { outDir: "dist", assetsDir: "assets", sourcemap: false },
});
