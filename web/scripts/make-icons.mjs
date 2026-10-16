// Generates the app icons (favicon, home-screen and install icons) from
// one design: a white medical cross on the brand blue. Rerun after
// changing the design:  node scripts/make-icons.mjs
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const BLUE = "#3b82f6";
// Cross drawn on a 100x100 grid, centered; `s` scales it (maskable icons
// keep it inside the 80% safe zone).
const cross = s => {
  const arm = 18 * s, len = 56 * s, r = 4 * s, a = 50 - arm / 2, b = 50 - len / 2;
  return `<rect x="${a}" y="${b}" width="${arm}" height="${len}" rx="${r}" fill="#fff"/>` +
         `<rect x="${b}" y="${a}" width="${len}" height="${arm}" rx="${r}" fill="#fff"/>`;
};
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${BLUE}"/>${cross(1)}</svg>`;
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${BLUE}"/>${cross(0.8)}</svg>`;

const png = (svg, size, out) => sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(out);

writeFileSync("app/icon.svg", rounded + "\n");
await png(fullBleed, 180, "app/apple-icon.png"); // iOS rounds the corners itself
await png(rounded, 192, "public/icons/icon-192.png");
await png(rounded, 512, "public/icons/icon-512.png");
await png(fullBleed, 512, "public/icons/maskable-512.png");
console.log("icons written");
