// Renders the mark to PNG: `render-check` byte-compares against it, and doing it in Node avoids headless-Chromium flakiness.

import { deflateSync } from "node:zlib";
import { MARK_BOX, MARK_RGB, MARK_TILE_RADIUS } from "./app-mark.mjs";

const TILE_RECT = { x: 0, y: 0, size: MARK_BOX, radius: MARK_TILE_RADIUS };

// Inside a rounded rect unless past one of its four corner arcs — a distance test to the corner's own centre.
function inside(x, y, rect) {
  const cx = Math.min(Math.max(x, rect.x + rect.radius), rect.x + rect.size - rect.radius);
  const cy = Math.min(Math.max(y, rect.y + rect.radius), rect.y + rect.size - rect.radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= rect.radius * rect.radius;
}

// One RGBA buffer, `size` square, supersampled to a fixed resolution so the 16px corner radius stays sub-pixel, and coverage-averaged so edge pixels mix tile and quad.
function markPixels(size, quads) {
  const steps = Math.ceil(1024 / size);
  const samples = steps * steps;
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < steps; sy++) {
        for (let sx = 0; sx < steps; sx++) {
          const x = ((px + (sx + 0.5) / steps) * MARK_BOX) / size;
          const y = ((py + (sy + 0.5) / steps) * MARK_BOX) / size;
          const colour = quads.some((quad) => inside(x, y, quad))
            ? MARK_RGB.quad
            : inside(x, y, TILE_RECT)
              ? MARK_RGB.tile
              : null;
          if (!colour) continue;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          covered++;
        }
      }
      const at = (py * size + px) * 4;
      if (!covered) continue;
      pixels[at] = Math.round(r / covered);
      pixels[at + 1] = Math.round(g / covered);
      pixels[at + 2] = Math.round(b / covered);
      pixels[at + 3] = Math.round((covered / samples) * 255);
    }
  }

  return pixels;
}

const CRC_TABLE = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buffer) {
  let c = -1;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const footer = Buffer.alloc(4);
  footer.writeUInt32BE(crc32(body));
  return Buffer.concat([header, body, footer]);
}

// 8-bit RGBA, no interlace, every scanline filtered "none" — the exact format `png-probe.mjs` decodes.
export function markPng(size, quads) {
  const pixels = markPixels(size, quads);

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
