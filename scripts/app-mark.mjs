// The app mark on a 128-unit grid; kept as its own module so `render-check` can sample the shipped PNGs at these numbers.

/** The canvas. Every number below is in these units, whatever size is drawn. */
export const MARK_BOX = 128;

/** Radius of the accent tile: ~23% of the box, the desktop app-icon convention. */
export const MARK_TILE_RADIUS = 30;

// Padding and gap chosen so the cross between quads is even and the group sits centred (32 + 27 + 10 + 27 + 32).
const PADDING = 32;
const GAP = 10;
const QUAD = (MARK_BOX - 2 * PADDING - GAP) / 2;
const FAR = PADDING + QUAD + GAP;

// Quads use the tile's own radius-to-size ratio, so they read as small copies of the tile, not a different shape.
const QUAD_RADIUS = 7;

// The 48/128 layout; named by the size list below (not exported) since the two layouts are only ever chosen in one place.
const MARK_QUADS = [
  { x: PADDING, y: PADDING, size: QUAD, radius: QUAD_RADIUS },
  { x: FAR, y: PADDING, size: QUAD, radius: QUAD_RADIUS },
  { x: PADDING, y: FAR, size: QUAD, radius: QUAD_RADIUS },
  { x: FAR, y: FAR, size: QUAD, radius: QUAD_RADIUS },
];

// The 16px layout: wider quads (4.5px) and cross (1.5px) so four tiles stay legible at toolbar size, where the default reads as a blue-grey haze.
const SMALL_PADDING = 22;
const SMALL_GAP = 12;
const SMALL_QUAD = (MARK_BOX - 2 * SMALL_PADDING - SMALL_GAP) / 2;
const SMALL_FAR = SMALL_PADDING + SMALL_QUAD + SMALL_GAP;

const MARK_QUADS_SMALL = [
  { x: SMALL_PADDING, y: SMALL_PADDING, size: SMALL_QUAD, radius: 5 },
  { x: SMALL_FAR, y: SMALL_PADDING, size: SMALL_QUAD, radius: 5 },
  { x: SMALL_PADDING, y: SMALL_FAR, size: SMALL_QUAD, radius: 5 },
  { x: SMALL_FAR, y: SMALL_FAR, size: SMALL_QUAD, radius: 5 },
];

// Colours (accent `#2f6feb` + white) and the layout each size draws; frozen in light theme because the PNG can't follow a theme and the quads are white regardless.
export const MARK_RGB = { tile: [47, 111, 235], quad: [255, 255, 255] };

export const MARK_SIZES = [
  { size: 16, quads: MARK_QUADS_SMALL },
  { size: 48, quads: MARK_QUADS },
  { size: 128, quads: MARK_QUADS },
];

/** Where a point in the 128-unit grid lands in a raster `size` pixels across. */
export function markPixel(units, size) {
  return Math.floor((units * size) / MARK_BOX);
}

// Quadness 0=pure tile, 1=pure quad, measured on the red channel (208 range vs blue's 20) as a size-independent fraction rather than a per-channel tolerance.
export function quadness(pixel) {
  return (pixel[0] - MARK_RGB.tile[0]) / (MARK_RGB.quad[0] - MARK_RGB.tile[0]);
}
