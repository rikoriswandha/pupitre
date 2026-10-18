/**
 * Shared visual config for build-time OG cards.
 *
 * Edit this file to retune generated card colors, spacing, and fonts. Both
 * the per-page endpoint (`og/[...slug].ts`) and the homepage fallback
 * (`og.png.ts`) spread this object into `astro-og-canvas`.
 *
 * The card follows the Pupitre ledger look (DESIGN.md): warm paper canvas,
 * ink text, a serif title and one blotter-green rule.
 *
 * Leading underscore tells Astro to skip routing for this file — it sits
 * inside `src/pages/` to be next to its consumers, but it's not a route.
 */

import type { OGImageOptions } from "astro-og-canvas";

export const ogCardConfig = {
  bgGradient: [[249, 247, 242]],
  border: { color: [19, 107, 75], width: 16, side: "block-start" },
  padding: 80,
  logo: { path: "./public/logo.png", size: [104] },
  fonts: ["./public/fonts/SourceSerif4-Regular.ttf", "./public/fonts/Inter-Bold.ttf"],
  font: {
    title: {
      color: [32, 27, 22],
      size: 72,
      weight: "Normal",
      families: ["Source Serif 4"],
      lineHeight: 1.12,
    },
    description: {
      color: [101, 95, 89],
      size: 32,
      weight: "Bold",
      families: ["Inter"],
      lineHeight: 1.35,
    },
  },
  format: "PNG",
} satisfies Partial<OGImageOptions>;
