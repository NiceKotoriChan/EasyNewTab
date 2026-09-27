/**
 * Just enough PNG to sample pixels, for the two places that need to.
 *
 * `make-app-icons.mjs` checks what it is about to overwrite the shipped icons with, and
 * `render-check.mjs` checks the committed files. Both need real pixels: dimensions alone
 * cannot tell the mark from a blank square of the same size, which is exactly the
 * failure that would go unnoticed — the old icon was also a 128px PNG.
 *
 * Decoding here rather than reaching for image tooling keeps the guardrail inside
 * `npm run check`, which has no browser and no dependencies. `zlib` is already in Node,
 * and an 8-bit RGBA scanline is four bytes per pixel behind one filter byte.
 */

import { inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/** In place, because each row is read back by the next one as its `up`. */
function unfilter(type, row, up, bpp) {
  for (let i = 0; i < row.length; i++) {
    const left = i >= bpp ? row[i - bpp] : 0;
    const above = up[i];
    const aboveLeft = i >= bpp ? up[i - bpp] : 0;
    if (type === 0) continue;
    else if (type === 1) row[i] = (row[i] + left) & 0xff;
    else if (type === 2) row[i] = (row[i] + above) & 0xff;
    else if (type === 3) row[i] = (row[i] + ((left + above) >> 1)) & 0xff;
    else if (type === 4) row[i] = (row[i] + paeth(left, above, aboveLeft)) & 0xff;
    else throw new Error(`unknown scanline filter ${type}`);
  }
}

/**
 * `{ width, height, at(x, y) }`, where `at` returns `[r, g, b, a]` at 0–255.
 */
export function readPng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");

  let header = null;
  const chunks = [];
  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        color: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") chunks.push(data);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (!header) throw new Error("no IHDR chunk");
  if (header.depth !== 8 || header.color !== 6 || header.interlace !== 0) {
    throw new Error(
      `only 8-bit non-interlaced RGBA is decoded here, got depth ${header.depth}, colour type ${header.color}, interlace ${header.interlace}`,
    );
  }

  const { width, height } = header;
  const stride = width * 4;
  const raw = inflateSync(Buffer.concat(chunks));
  const pixels = Buffer.alloc(stride * height);
  const up = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const from = y * (stride + 1);
    const row = raw.subarray(from + 1, from + 1 + stride);
    row.copy(pixels, y * stride);
    const line = pixels.subarray(y * stride, (y + 1) * stride);
    unfilter(raw[from], line, up, 4);
    line.copy(up);
  }

  return {
    width,
    height,
    at(x, y) {
      const i = y * stride + x * 4;
      return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    },
  };
}
