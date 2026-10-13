# @rikology/pupitre-ui

Default Pupitre catalog components built on Base UI. Use the npm package for managed defaults, or own individual component source files using the public shadcn registry.

## Copy components with shadcn

In an initialized shadcn host:

```sh
node ace pupitre:ui add select --yes
# Equivalent installer:
npx shadcn@4 add https://pupitre.rikology.com/r/select.json --yes
```

The Ace command validates kebab-case names against `https://pupitre.rikology.com/registry.json`. It supports multiple names, `--registry <origin>`, `--yes`, and `--dry-run`. Hook item names use hyphens even when their source filenames use underscores. Local registries can use loopback HTTP or `file:///absolute/path/to/registry/public`; regenerate dependency URLs for the same local origin.

Every payload file is `registry:file` with an explicit `~/inertia/components/pupitre/<source-path>` target. Shadcn resolves `~/` from the host root (`--cwd` for the direct installer), independently of `components.json` aliases and Vite's `src` directory. **Do not pass `--path`**: shadcn flattens every file to its basename, breaking relative imports. The Ace wrapper intentionally does not expose this option.

Files retain their source layout: `inertia/components/pupitre/components/Select.tsx`, `primitives/index.tsx`, and `icons.tsx`. Relative `.js` imports resolve to `.ts`/`.tsx` under Vite. Registry dependencies include primitives, icons, hooks, and helpers; runtime/catalog imports remain npm dependencies. No server code is copied.

Activate the copied component in `inertia/admin/registry.ts`:

```tsx
import { components as pupitreUi } from '@rikology/pupitre-ui/components'
import { Select as MySelect } from '../components/pupitre/components/Select.js'

// Pass this component map to your existing defineRegistry call:
const components = { ...pupitreUi, Select: MySelect }
```

To own styles too, add the `styles` item and import `components/pupitre/styles.css` after Tailwind in your CSS entry. Otherwise keep the npm stylesheet import. Copying a component does not automatically change the runtime registry or import CSS.

Keep host-only CSS variables namespaced (for example `--site-muted`, `--site-card`, and `--site-ring` for public-site styles). Hosts must not redefine Pupitre's unlayered semantic tokens: `--background`, `--foreground`, `--card*`, `--popover*`, `--primary*`, `--secondary*`, `--muted*`, `--accent*`, `--destructive*`, `--border`, `--input`, `--ring`, `--radius`, and `--sidebar*`. Equal-specificity unlayered host declarations imported later override Pupitre's light/dark defaults and can break surface and focus contrast. If an existing host theme uses these names, place its defaults in a cascade layer (for example `@layer base`) so Pupitre's unlayered declarations take precedence, or namespace them. Customize panel themes through Pupitre's theme configuration instead. Pupitre's `--muted` is a background surface, not a text color. The auth canvas is opaque so its contrast does not depend on the host body background.

## Build and serving contract

Run `npm run registry:build` from the monorepo root after source edits and commit the generated JSON. `npm run registry:check` detects stale outputs and tests copy-ability of every item from JSON alone.

- Source manifest: `registry/registry.json`.
- Public index: `registry/public/registry.json`.
- Inlined item payloads: `registry/public/r/<name>.json`.
- Docs site must serve `registry/public` at its root, exposing `/registry.json` and `/r/*` as JSON.
- Default item origin: `https://pupitre.rikology.com/r`.
- For isolated local generation: `node tools/registry-build/index.mjs --base-url http://localhost:3404/r --output /tmp/pupitre-registry`.
- Real installer smoke: `node tools/registry-build/shadcn-smoke.mjs` runs shadcn@4 into an isolated Vite/React/TS host and type-checks the copied source. Unpublished npm dependencies are pre-provisioned from the workspace; only their version specifiers are omitted in the served smoke payload to prevent reinstallation.

Schemas are pinned to [registry.json](https://ui.shadcn.com/schema/registry.json) and [registry-item.json](https://ui.shadcn.com/schema/registry-item.json); see the [shadcn registry documentation](https://ui.shadcn.com/docs/registry).

## Realtime tables and notifications

Pass a stable client to `<Pupitre registry={registry} realtime={client} />` or `PupitreShell`. `DataTable` subscribes to `descriptor.realtime.channel` and coalesces table pings into a partial reload of `descriptor.dataProp` (default `data`). `NotificationTray` reloads shared `pupitre` props on user-channel notification pings, and refreshes inbox items when already open. Superseded inbox requests are aborted and stale responses ignored.

Both components retain configured polling without a client or channel, and clean up subscriptions on unmount. UI components consume React hooks and catalog descriptors, not transport-specific clients.
