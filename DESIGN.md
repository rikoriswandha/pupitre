---
name: Pupitre
description: Writing-desk admin skin for AdonisJS panels; warm paper neutrals, one blotter-green primary.
colors:
  canvas: "oklch(0.978 0.0035 84)"
  card: "oklch(0.996 0.0015 84)"
  sidebar: "oklch(0.963 0.005 82)"
  ink: "oklch(0.225 0.012 65)"
  ink-muted: "oklch(0.49 0.012 68)"
  ink-subtle: "oklch(0.62 0.01 70)"
  hairline: "oklch(0.908 0.006 78)"
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
  primary-dark: "oklch(0.56 0.1 163)"
typography:
  page-title:
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "-0.015em"
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
  panel-x: "24px"
  panel-y: "16px"
  stack: "24px"
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
  panel:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
    padding: "{spacing.panel-y} {spacing.panel-x}"
  nav-item-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "32px"
---

# Pupitre Design System

Canonical tokens live in `packages/pupitre-ui/src/styles.css`; primitives in `packages/pupitre-ui/src/primitives/index.tsx`. This file describes how to apply them.

## Overview

A well-kept writing desk, not a cockpit. Operators spend hours in tables and forms under office daylight, so the default is light, quiet, and dense enough to scan; dark mode gets equal craft. Structure comes from three warm paper layers (canvas, sidebar, raised card), hairline borders, and precise type. One confident primary marks action, selection, and focus. Everything else stays neutral so data reads first.

Layout is the familiar admin frame: a 16rem sidebar (4rem icon rail when collapsed, or a top bar in `top-nav` panels), a sticky 56px topbar with search, notifications, and the user menu, then a page header with breadcrumbs above the title and header actions on the right. Content sits in panels on the canvas with 24px stacks between them. Density is a token switch (`data-density="compact"`) that tightens control heights and row padding, never a separate design.

## Colors

Restrained strategy: tinted neutrals plus one accent used for primary buttons, current navigation, selection, focus rings, and links in prose.

- **Neutrals** carry hue ~75 at chroma 0.0015 to 0.012, so paper reads warm without looking beige. Canvas < sidebar < card in lightness order for light mode; dark mode keeps the same order inverted around a warm charcoal.
- **Primary (blotter green)** `oklch(0.47 0.095 163)`. A panel's `theme.primary` replaces it; every derived token follows.
- **Derived tokens**: `--X-soft` (selection and badge fills) and `--X-ink` (readable colored text) are `color-mix(in oklab, ...)` of the base with the card or foreground color, for primary, success, warning, danger, and info. Always mix in oklab: oklch takes the short hue arc and turns blue + warm gray into red.
- **Semantic**: success green, warning ochre, danger brick, info ink-blue. Status never relies on color alone; badges carry text and icons.
- **Charts**: `--chart-1` is the primary; 2 to 6 are ochre, ink-blue, terracotta, plum, olive at matched lightness.
- **Boundaries**: text-like controls use the soft `--input` border (label and placeholder identify them); state-only controls (checkbox, radio, switch track) use `--input-strong` for at least 3:1 against the card.
- Never hardcode `#fff`, `#000`, Tailwind palette colors, or `bg-black/50`. Scrims use `--scrim`.

## Typography

One family. Panels may set `theme.font` (the example uses Inter); otherwise the system UI stack. Fixed rem scale with ~1.15 ratio: 12 meta, 13 helper, 14 body and controls, 15 section titles, 24 page titles. Labels are 14px medium; helper and error copy 13px. Numbers in tables, stats, badges, and pagination use tabular figures. No uppercase tracking labels, no display fonts in UI.

## Elevation

Flat with hairlines; shadow only signals a layer.

- `shadow-control`: 1px hint under buttons, inputs, active nav items.
- `shadow-panel`: panels (sections, tables, widgets) on the canvas.
- `shadow-popover`: menus, listboxes, popovers, tooltips.
- `shadow-dialog`: dialogs, slide-overs, global search.

Dark mode leans on borders; shadows are deeper but subtle. No blur or glass anywhere.

Motion: 150 to 250ms on three tokens: `ease-ui` (`cubic-bezier(0.23,1,0.32,1)`) for entering and leaving, `ease-move` (`cubic-bezier(0.77,0,0.175,1)`) for on-screen movement, and `ease-drawer` (`cubic-bezier(0.32,0.72,0,1)`) for edge sheets. Popups scale from 0.98 at their trigger origin; sheets slide; disclosures (`Collapse`) animate height with a fade; toasts open and close their slot from the bottom edge; the sidebar rail toggle morphs through a view transition; buttons press to 0.97. Animate opacity and transform, except disclosure height. Keyboard-driven and high-frequency state (tab switches, page navigation, row hover) stays instant. `prefers-reduced-motion` collapses durations and skips the sidebar morph.

## Components

- **Buttons**: `variant` solid / outline / ghost / link times `color` primary / gray / success / warning / danger / info, sizes xs to lg, `square` for icon-only (always with a tooltip and aria-label). Gray solid is the neutral default: card fill, control border, 1px shadow.
- **Action lists**: page headers promote the leading uncolored action to primary and collapse past three into a "More actions" menu; table rows show two ghost link actions and move the rest, destructive last, into the menu. Delete-like actions are inferred as danger.
- **Controls**: 36px (32px compact), 8px radius, control border, card fill. Focus: primary border plus a 3px ring at 20%. Invalid: danger border. Disabled: muted fill. Prefix/suffix text sits in muted addon segments inside an input group; inline actions are xs ghost buttons.
- **Selects and pickers** open popups anchored to a control-styled trigger; listboxes are never inline.
- **Panels**: 12px radius, hairline border, card fill. Header 16px by 24px with title, description, optional icon and aside; body 24px. Never nest panels: components inside a panel read `PanelNestingContext` and drop to a plain group (sections) or a bordered, shadowless block (tables).
- **Tables**: one panel containing toolbar (search, filters popover, columns popover, bulk actions), muted header row, rows with hover and soft-primary selection, footer with range text, per-page, and pagination. Empty states teach the next step.
- **Navigation**: active sidebar item is a raised card chip with a primary icon; badges are small tabular pills. Record sub-navigation uses underline tabs; list tabs and view switches use the segmented control.
- **Overlays**: dialogs 16px radius with header, scrolling body, and muted footer holding right-aligned actions; confirmations put a tone-soft icon circle beside the heading.
- **Feedback**: skeletons for loading content, spinners only inside buttons and inline status, toasts as popover cards with a typed leading icon.

## Do's and Don'ts

- Do put every table, form section, widget, and infolist in exactly one panel.
- Do derive any new colored state from `--X-soft` / `--X-ink`, so a primary override re-skins it.
- Do keep accessible names stable; host test helpers depend on them.
- Do verify both light and dark before shipping a component.
- Don't use colored side-stripe borders, gradient text, glassmorphism, or hero-metric tiles.
- Don't render bare fields on the canvas or stack equal-weight colored buttons in a row.
- Don't use link-blue text as hierarchy; record links are foreground text with hover underline.
- Don't mix colors with `color-mix(in oklch, ...)` across different hues.
