---
name: Pupitre
description: Ledger admin skin for AdonisJS panels; warm paper canvas, ink rules instead of cards, one blotter-green primary.
colors:
  canvas: "oklch(0.976 0.0065 84)"
  card: "oklch(0.996 0.0015 84)"
  sidebar: "oklch(0.963 0.005 82)"
  ink: "oklch(0.225 0.012 65)"
  ink-muted: "oklch(0.49 0.012 68)"
  ink-subtle: "oklch(0.62 0.01 70)"
  rule: "oklch(0.38 0.014 66)"
  hairline: "oklch(0.905 0.008 78)"
  control-border: "oklch(0.868 0.008 76)"
  control-border-strong: "oklch(0.6 0.012 72)"
  primary: "oklch(0.47 0.095 163)"
  on-primary: "oklch(0.985 0.008 160)"
  danger: "oklch(0.545 0.19 27)"
  success: "oklch(0.52 0.12 148)"
  warning: "oklch(0.72 0.15 72)"
  info: "oklch(0.52 0.13 245)"
  canvas-dark: "oklch(0.172 0.005 70)"
  card-dark: "oklch(0.205 0.006 70)"
  sidebar-dark: "oklch(0.155 0.005 70)"
  ink-dark: "oklch(0.94 0.006 82)"
  rule-dark: "oklch(0.6 0.01 76)"
  primary-dark: "oklch(0.545 0.1 163)"
typography:
  page-title:
    fontFamily: "var(--pupitre-font-display): Source Serif 4 (shipped), Iowan Old Style, Charter, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  section-title:
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.6
  body:
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  helper:
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.54
  meta:
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
spacing:
  control-h: "36px"
  control-h-compact: "32px"
  region-gap: "40px"
  section-head: "12px 0 16px"
  field-gap: "20px 24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    height: "{spacing.control-h}"
    padding: "0 14px"
  button-gray:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "{spacing.control-h}"
    padding: "0 14px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "{spacing.control-h}"
    padding: "0 12px"
  ledger-section:
    borderTop: "1px solid {colors.rule}"
    padding: "{spacing.section-head}"
  nav-item-active:
    backgroundColor: "{colors.sidebar-accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "32px"
---

# Pupitre Design System

Canonical tokens live in `packages/pupitre-ui/src/styles.css`; primitives in `packages/pupitre-ui/src/primitives/index.tsx`. This file describes how to apply them.

## Overview

A well-kept ledger on a writing desk, not a cockpit and not a wall of cards. Operators spend hours in tables, forms and records under office daylight, so the default is light, quiet, and dense enough to scan; dark mode gets equal craft.

Structure comes from **rules, not boxes**. Content sits directly on a warm paper canvas. Every region (a widget, a table, a form section, a record section) opens with a 1px ink rule and a heading row; inside a region, lines are hairlines. Boxes are reserved for things that really are objects or layers: controls, overlays, draggable cards, code blocks. The page title is set in a text serif, the desk's letterhead; everything else stays in one sans. One confident primary marks action, selection and focus.

The identity lives in structure and type, not colour, so it survives any `theme.primary` override.

Layout keeps the familiar admin frame: a 16rem sidebar (4rem icon rail, or a top bar in `top-nav` panels), a sticky 56px topbar with search, notifications and the user menu, then a page header with breadcrumbs above the serif title and header actions on the right. Regions stack 40px apart. Density is a token switch (`data-density="compact"`) that tightens control heights and row padding, never a separate design.

## Colors

Restrained strategy: tinted neutrals plus one accent used for primary buttons, current navigation, selection, focus rings, and links in prose.

- **Neutrals** carry hue ~75 at chroma 0.0015 to 0.012, so paper reads warm without looking beige. Canvas < sidebar < card in lightness order for light mode; dark mode keeps the same order around a warm charcoal.
- **Rule** `--rule` is the ink line that opens a region (Tailwind `border-rule`); **hairline** `--border` separates lines inside it. Never stack two ink rules.
- **Primary (blotter green)** `oklch(0.47 0.095 163)`. A panel's `theme.primary` replaces it; every derived token follows.
- **Derived tokens**: `--X-soft` (selection and badge fills) and `--X-ink` (readable colored text) are `color-mix(in oklab, ...)` of the base with the card or foreground color, for primary, success, warning, danger, and info. Always mix in oklab: oklch takes the short hue arc and turns blue + warm gray into red.
- **Semantic**: success green, warning ochre, danger brick, info ink-blue. Status never relies on color alone; badges carry text and icons.
- **Charts**: `--chart-1` is the primary; 2 to 6 are ochre, ink-blue, terracotta, plum, olive at matched lightness.
- **Boundaries**: text-like controls use the soft `--input` border; state-only controls (checkbox, radio, switch track) use `--input-strong` for at least 3:1 against the canvas.
- Never hardcode `#fff`, `#000`, Tailwind palette colors, or `bg-black/50`. Scrims use `--scrim`.

## Typography

- **Page title**: `font-display` (`--pupitre-font-display`), 30px, weight 400. The default is **Source Serif 4** (Adobe, OFL-1.1), shipped with `@rikology/pupitre-ui` through `@fontsource/source-serif-4` so titles render the same on every OS; only weight 400 is loaded and unicode-range subsets download on demand (one ~21 KB file for Latin pages). Only the Shell h1, the auth page title and the not-found title use it.
- **Everything else**: one sans. Panels may set `theme.font` (the example uses Inter); otherwise the system UI stack. Fixed rem scale: 12 meta, 13 helper, 14 body and controls, 15 section titles. Labels are 13px medium muted on record pages and 14px medium on forms.
- Numbers in tables, stats, badges and pagination use tabular figures; figures and money columns align right.
- No uppercase tracking labels, no display fonts in labels, buttons or data.

## Elevation

Flat. Rules and hairlines draw structure; shadow only signals a layer.

- `shadow-control`: 1px hint under buttons and inputs.
- `shadow-popover`: menus, listboxes, popovers, tooltips, toasts.
- `shadow-dialog`: dialogs, slide-overs, global search.
- `shadow-panel` remains for the rare real cards (grid-layout records, kanban cards).

Dark mode leans on rules and hairlines; shadows are deeper but subtle. No blur or glass anywhere.

Motion: 150 to 250ms on three tokens: `ease-ui` (`cubic-bezier(0.23,1,0.32,1)`) for entering and leaving, `ease-move` (`cubic-bezier(0.77,0,0.175,1)`) for on-screen movement, and `ease-drawer` (`cubic-bezier(0.32,0.72,0,1)`) for edge sheets. Popups scale from 0.98 at their trigger origin; sheets slide; disclosures (`Collapse`) animate height with a fade; toasts open and close their slot from the bottom edge; the sidebar rail toggle morphs through a view transition; buttons press to 0.97. Keyboard-driven and high-frequency state (tab switches, page navigation, row hover) stays instant. `prefers-reduced-motion` collapses durations and skips the sidebar morph.

## Components

- **Regions** (`LedgerSection`, `ledgerRuleClasses`): ink rule, heading row (`pt-3 pb-4`: 15px semibold title, 13px description, aside actions), then content on the canvas. Components already inside a region read `PanelNestingContext` and drop their own rule and heading chrome.
- **Widgets**: each widget is a region. Stats are one ruled strip of figures with hairline dividers (two columns on phones), the value shrinking to one line. The grid packs rows and stretches a row that would leave empty columns.
- **Tables**: list tabs sit on the rule as underline tabs; toolbar under the rule; header row without a band; hairline rows with hover and soft-primary selection; text flush with the rule; group headings as ruled subheads; totals under an ink rule; footer with range text, per-page and pagination after a hairline. Row actions are two inline ghost links plus a "More actions" menu. Empty states teach the next step.
- **Record pages**: each field is a hairline-ruled line (label above value; label beside value on phones). Sections are regions. Plain repeated records render as a ruled table. Three or more empty fields fold behind "Show N empty fields".
- **Forms**: sections are regions; fields sit on the canvas with their own control styling; `aside` sections put the heading left and fields right under one rule; the footer is a hairline followed by actions. Inside dialogs the dialog is the only box: headings and hairlines, no rules at the top of the body.
- **Tabs**: tab list on the ink rule, underline on the active tab, content on the canvas. `contained: false` uses the segmented control for small view switches.
- **Buttons**: `variant` solid / outline / ghost / link times `color` primary / gray / success / warning / danger / info, sizes xs to lg, `square` for icon-only (always with a tooltip and aria-label). Header actions promote the leading uncolored action to primary and collapse past three into "More actions"; delete-like actions are inferred as danger.
- **Controls**: 36px (32px compact), 8px radius, control border, card fill. Focus: primary border plus a 3px ring at 20%. Invalid: danger border. Disabled: muted fill. Selects and pickers open popups anchored to a control-styled trigger; listboxes are never inline.
- **Navigation**: active sidebar item is a quiet `sidebar-accent` fill with foreground text, no shadow and no side stripe. Record sub-navigation uses underline tabs.
- **Overlays**: dialogs 16px radius with header, scrolling body and footer holding right-aligned actions; confirmations put a tone-soft icon circle beside the heading.
- **Auth pages**: no floating card; brand, serif title, ink rule, form on the canvas in a narrow column.
- **Feedback**: skeletons for loading content, spinners only inside buttons and inline status, toasts as popover cards with a typed leading icon.

## Do's and Don'ts

- Do open every page region with exactly one ink rule and put its lines on hairlines.
- Do keep boxes for controls, overlays, draggable cards and code; nothing else.
- Do derive any new colored state from `--X-soft` / `--X-ink`, so a primary override re-skins it.
- Do keep accessible names stable; host test helpers depend on them.
- Do verify both light and dark, and a 390px phone, before shipping a component.
- Don't wrap content in cards, nest boxes, or stack two rules.
- Don't use colored side-stripe borders, gradient text, glassmorphism, or hero-metric tiles.
- Don't use link-blue text as hierarchy; record links are foreground text with hover underline.
- Don't mix colors with `color-mix(in oklch, ...)` across different hues.
- Host pages that render Pupitre surfaces outside the Shell must paint `body` with `--background`; ledger surfaces are transparent.
