import { defineConfig } from "vite";

// Luna ships no framework and no assets - the whole UI is a few KB of JS that
// paints a 26x24 pixel cat. Keep it that way.
export default defineConfig({
  // Tauri serves the bundle from a custom protocol, so relative paths only.
  base: "./",
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    // Never watch the Rust build output - the running binary is locked on
    // Windows and the watcher dies on it.
    watch: { ignored: ["**/src-tauri/**", "**/dist/**"] },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    reportCompressedSize: false,
  },
});
