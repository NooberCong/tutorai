// Rasterizes the icon design source (src-tauri/icons/icon.svg) to a 1024px
// PNG, which `tauri icon` then fans out to every platform format.
// Usage: npm run icon
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("src-tauri/icons/icon.svg", "utf8");
const png = new Resvg(svg, {
  fitTo: { mode: "width", value: 1024 },
}).render().asPng();
writeFileSync("src-tauri/icons/icon-source.png", png);
console.log("wrote src-tauri/icons/icon-source.png", png.length, "bytes");
