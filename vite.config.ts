import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// pdf.js decodes JPEG 2000 / JBIG2 images (common in scanned books) with wasm
// modules it fetches at runtime from `wasmUrl` by their original file names, so
// they must be served together under a fixed, unhashed folder.
const PDFJS_WASM_DIR = path.resolve(__dirname, "node_modules/pdfjs-dist/wasm");
const PDFJS_WASM_ROUTE = "pdfjs/wasm/";

function pdfjsWasm(): Plugin {
  return {
    name: "pdfjs-wasm",
    configureServer(server) {
      server.middlewares.use(`/${PDFJS_WASM_ROUTE}`, (req, res, next) => {
        const name = path.basename(decodeURIComponent((req.url ?? "").split("?")[0]));
        const file = path.join(PDFJS_WASM_DIR, name);
        if (!name || !fs.existsSync(file)) return next();
        res.setHeader("Content-Type", name.endsWith(".wasm") ? "application/wasm" : "text/javascript");
        fs.createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      for (const name of fs.readdirSync(PDFJS_WASM_DIR)) {
        if (name.startsWith("LICENSE")) continue;
        this.emitFile({
          type: "asset",
          fileName: PDFJS_WASM_ROUTE + name,
          source: fs.readFileSync(path.join(PDFJS_WASM_DIR, name)),
        });
      }
    },
  };
}

// Tauri expects a fixed dev port and no auto-open.
export default defineConfig({
  plugins: [react(), pdfjsWasm()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 2000,
  },
});
