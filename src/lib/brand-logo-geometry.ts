/**
 * Canonical 2026 Flagship Optical-Refraction Geometry for the Scienta Monogram.
 *
 * Constructed on a strict 64x64 coordinate grid centered at (32, 32) from ONLY TWO
 * 180-degree rotationally symmetric forms:
 *   1. Inward Optical Interlock (Snell Refraction Toward Normal): Upper spine sits at
 *      y=29.3..36.5 and lower spine at y=27.5..34.7 — an inward 1.8px optical step across
 *      a razor-crisp 3.49px parallel 63.4-degree (2x + y = const) light slit, keeping both
 *      inner counters open (14.1px) and interlocking the two prisms smoothly from inside.
 *   2. Continuous G2 Superellipse Curvature: Sculpted squircle shoulders with a whisper-subtle
 *      1.4px inward terminal inflection at the top-right and bottom-left tips.
 *   3. Subtle Aerodynamic Taper (~16%): 8.6px outer optical belly tapering gracefully
 *      to 7.2px into the diagonal prism cuts and parallel outer terminals.
 */

export const SCIENTA_LOGO_VIEWBOX = "0 0 64 64";

export const SCIENTA_LOGO_PATHS = {
  /** Upper optical prism half — brushed platinum-ivory plane */
  prismUpper:
    "M 49.2 9.4 C 42.5 8.1 35.5 8 28.5 8 C 18.2 8 12.4 13.55 12.4 22.25 C 12.4 30.95 17.95 36.5 27.8 36.5 L 31.4 29.3 L 28.5 29.3 C 23.8 29.3 21 26.5 21 22.25 C 21 18 23.8 15.2 28.5 15.2 C 34.5 15.2 40.5 15.4 45.6 16.6 Z",

  /** Lower optical prism half — exact 180-degree rotational twin around (32, 32) */
  prismLower:
    "M 14.8 54.6 C 21.5 55.9 28.5 56 35.5 56 C 45.8 56 51.6 50.45 51.6 41.75 C 51.6 33.05 46.05 27.5 36.2 27.5 L 32.6 34.7 L 35.5 34.7 C 40.2 34.7 43 37.5 43 41.75 C 43 46 40.2 48.8 35.5 48.8 C 29.5 48.8 23.5 48.6 18.4 47.4 Z",
} as const;
