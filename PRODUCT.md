# Product

## Register

product

## Users

Two audiences share every screen:

- **Operators**: editors, support staff, and back-office admins who live inside a Pupitre panel for hours. They scan tables, filter, open records, and fill long forms on a laptop in office daylight. They need density, scan speed, keyboard flow, and chrome that stays out of the way.
- **Developers evaluating or adopting Pupitre**: AdonisJS v7 + Inertia React developers comparing it to Filament. They judge it from the first `npm create`, the README screenshots, and how far the defaults get them before theming.

When the two conflict, operator ergonomics are the floor; the defaults must still look finished enough to screenshot without customization.

## Product Purpose

Pupitre is a Filament-class admin panel framework for AdonisJS v7 + Inertia React. Developers declare panels, resources, forms, tables, actions, and widgets on the server; one generic Inertia page renders them through a catalog of React components. The UI package (`@rikology/pupitre-ui`) is the default skin and is also distributed as a shadcn registry so hosts can own and edit the components.

Success: an operator trusts the interface as much as Filament or Stripe's dashboard on first use, and a developer ships a panel without restyling a single component.

## Brand Personality

**Composed, exact, warm.** The name means "writing desk": an orderly, well-kept desk rather than a cockpit. Precise typography and alignment, quiet structure, neutrals with a slight warmth instead of cold gray, and one confident primary color that marks action and selection. Familiar to Filament users without copying it.

## Anti-references

- **The previous Pupitre skin**: controls that look unstyled, selects rendered as permanently open lists, stacked per-row action buttons, header actions duplicated across pages, flat pure-black dark mode, link-blue text as the only hierarchy.
- **Glassy AI-SaaS**: blur panels, gradient glows, purple accents, gradient text, hero-metric tiles.

## Design Principles

1. **The task is the interface.** Tables, forms, and record pages carry the visual weight; shell chrome recedes.
2. **Earned familiarity.** Standard admin affordances (sidebar, breadcrumbs, filters, row actions in a menu, modals for confirmations) behave exactly as operators expect from Filament-class tools.
3. **Exact over decorated.** Alignment, consistent control heights, and type hierarchy do the work; no ornament that does not convey state.
4. **Themeable by default.** Every color flows from tokens a panel can override (`primary`, `radius`, `vars`, dark mode), so one primary swap re-skins the whole panel coherently.
5. **Every state designed.** Empty, loading, error, disabled, selected, and focus states ship with each component, not as afterthoughts.

## Accessibility & Inclusion

WCAG 2.2 AA: text contrast at least 4.5:1 (3:1 for large text and UI boundaries), visible focus rings on every interactive element, minimum 24px targets, full keyboard operation, `prefers-reduced-motion` respected, status never conveyed by color alone.
