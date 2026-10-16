// Generates the favicon, home-screen and install icons from the official
// brand SVGs in assets/brand (four tiles forming a cross, brand blue).
// Rerun after the brand files change:  node scripts/make-icons.mjs
import { copyFileSync } from "node:fs";
import sharp from "sharp";

const brand = name => `assets/brand/${name}.svg`;
const png = (name, size, out) => sharp(brand(name), { density: 600 }).resize(size, size).png().toFile(out);

copyFileSync(brand("favicon"), "app/icon.svg");                  // drawn for 16 px
await png("app-icon-ios", 180, "app/apple-icon.png");            // full bleed; iOS rounds the corners
await png("app-icon", 192, "public/icons/icon-192.png");
await png("app-icon", 512, "public/icons/icon-512.png");
await png("app-icon-maskable", 512, "public/icons/maskable-512.png"); // cross inside the 80% safe zone
console.log("icons written");
