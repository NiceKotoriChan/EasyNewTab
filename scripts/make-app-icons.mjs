/**
 * Write the app mark to `public/icons/icon{16,48,128}.png`.
 *
 *   npm run icons
 *
 * A thin wrapper: `mark-png.mjs` draws the bytes, this puts them where the manifest
 * points and checks them on the way out. Run it after touching `app-mark.mjs` — and if
 * you forget, `npm run check` says so, because the guardrail renders the mark again and
 * compares.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { MARK_SIZES, markPixel, quadness } from "./app-mark.mjs";
import { markPng } from "./mark-png.mjs";
import { readPng } from "./png-probe.mjs";

/** Read back through the decoder the guardrail uses, so a written file that does not
 *  decode as this mark fails here rather than at the next `npm run check`. */
function verify(path, size, quads) {
  const png = readPng(readFileSync(path));
  if (png.width !== size || png.height !== size) {
    throw new Error(`${path}: expected ${size}×${size}, got ${png.width}×${png.height}`);
  }

  const corner = png.at(0, 0);
  if (corner[3] !== 0) {
    throw new Error(`${path}: the corner is opaque (${corner.join(",")}) — the rounding was lost`);
  }

  const edge = png.at(size >> 1, 0);
  if (edge[3] !== 255 || quadness(edge) > 0.1) {
    throw new Error(`${path}: the tile's top edge is ${edge.join(",")}, expected the tile colour`);
  }

  const first = quads[0];
  const centre = png.at(
    markPixel(first.x + first.size / 2, size),
    markPixel(first.y + first.size / 2, size),
  );
  if (centre[3] !== 255 || quadness(centre) < 0.85) {
    throw new Error(`${path}: the quad centre is ${centre.join(",")}, expected the quad colour`);
  }

  const cross = png.at(size >> 1, size >> 1);
  if (cross[3] !== 255 || quadness(cross) > 0.35) {
    throw new Error(`${path}: the cross between the quads is ${cross.join(",")} — the quads have merged`);
  }
}

const target = new URL("../public/icons/", import.meta.url);

for (const { size, quads } of MARK_SIZES) {
  const path = new URL(`icon${size}.png`, target).pathname;
  const png = markPng(size, quads);
  writeFileSync(path, png);
  verify(path, size, quads);
  console.log(`  ${String(size).padStart(3)}px  public/icons/icon${size}.png  ${png.length} bytes`);
}

console.log("app icons written");
