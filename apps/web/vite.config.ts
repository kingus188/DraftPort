import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Read package.json explicitly to avoid ESM require issues
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
);

export default defineConfig({
  base: "./",
  // Pin the dev server so the Tauri shell (devUrl http://127.0.0.1:5173) always
  // finds it: bind IPv4 to avoid an IPv6-only `localhost` mismatch, and use
  // strictPort so a busy 5173 fails loudly instead of silently moving to 5174.
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@draftport/core": path.resolve(
        __dirname,
        "../../packages/core/src/index.ts",
      ),
    },
  },
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          codemirror: [
            "codemirror",
            "@codemirror/lang-markdown",
            "@codemirror/language",
            "@codemirror/state",
            "@codemirror/view",
            "@uiw/codemirror-theme-github",
          ],
        },
      },
    },
  },
});
