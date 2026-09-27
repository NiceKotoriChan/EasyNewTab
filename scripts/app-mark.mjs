/**
 * The app mark, on a 128-unit grid — the one drawing behind the extension icon in
 * `public/icons/`.
 *
 * Two consumers, both siblings of this file: `make-app-icons.mjs` rasterises these
 * numbers, and `render-check.mjs` samples the shipped PNGs at points derived from them.
 * That second one is why this is a module rather than a few lines inside the generator —
 * a guardrail holding its own copy of the numbers would keep passing after a retune that
 * was never rasterised, which is the failure worth catching.
 */

/** The canvas. Every number below is in these units, whatever size is drawn. */
export const MARK_BOX = 128;

/** Radius of the accent tile: ~23% of the box, the desktop app-icon convention. */
export const MARK_TILE_RADIUS = 30;

/** Padding and gap are set so the cross between the quads is even and the group sits
 *  centred: 32 + 27 + 10 + 27 + 32. */
const PADDING = 32;
const GAP = 10;
const QUAD = (MARK_BOX - 2 * PADDING - GAP) / 2;
const FAR = PADDING + QUAD + GAP;

/** Within a point of the outer tile's own radius-to-size ratio, so the quads read as
 *  small copies of the tile they sit on rather than as a different shape. */
const QUAD_RADIUS = 7;

/** The default layout: the 48 and 128 icons. Named by the size list below, not exported
 *  — the two layouts are only ever chosen in one place, and that is where it belongs. */
const MARK_QUADS = [
  { x: PADDING, y: PADDING, size: QUAD, radius: QUAD_RADIUS },
  { x: FAR, y: PADDING, size: QUAD, radius: QUAD_RADIUS },
  { x: PADDING, y: FAR, size: QUAD, radius: QUAD_RADIUS },
  { x: FAR, y: FAR, size: QUAD, radius: QUAD_RADIUS },
];

/** The 16px layout: fatter quads, a wider cross.
 *
 *  At 16px the layout above draws 3.4px quads split by a 1.25px cross, and the rounded
 *  corners plus antialiasing turn them into a blue-grey haze — visible in the
 *  rasterised file, not a matter of taste. Widening the quads to 4.5px and the cross to
 *  1.5px keeps four tiles legible at the size the toolbar actually draws. Only the 16px
 *  raster uses this, so it is named for the one size that does. */
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

/**
 * The colours — the app's own accent, `#2f6feb`, and white — and which layout each
 * shipped size draws.
 *
 * Here rather than in the app's tokens because a PNG cannot follow a theme, and the
 * light-theme accent is the one to freeze: the toolbar is usually light, and the quads
 * are white either way, so the pair stays correct on a dark toolbar too.
 */
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

/**
 * How much quad a pixel has in it, 0 = pure tile, 1 = pure quad.
 *
 * Measured on red, the channel with 208 of range between the two colours. Blue spans 20
 * between them and would call a white quad and a blue gap the same thing. A fraction
 * rather than a per-channel tolerance because it carries across sizes: at 16px no pixel
 * is entirely inside the 1.5px cross, and a fixed tolerance would have to be loosened
 * until it stopped proving anything.
 */
export function quadness(pixel) {
  return (pixel[0] - MARK_RGB.tile[0]) / (MARK_RGB.quad[0] - MARK_RGB.tile[0]);
}
