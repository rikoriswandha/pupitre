---
title: Customizing the UI
---

Pupitre separates the backend DSL, React runtime and visual components. `@rikology/pupitre-react` renders specs; `@rikology/pupitre-ui` supplies components; `@rikology/pupitre/catalog` owns the Zod wire contract. Change one visual component without changing your resource definitions.

## Registry overrides

```ts
// inertia/admin/registry.ts
import { defineRegistry } from '@rikology/pupitre-react'
import { components } from '@rikology/pupitre-ui'
import { Select as MySelect } from '../components/pupitre/components/Select.js'

export const registry = defineRegistry({ ...components, Select: MySelect })
```

Pass the returned registry to `<Pupitre {...props} registry={registry} />`. The argument is the component map itself, not `{ components: ... }` and not a catalog argument. `defineRegistry(components, { functions? })` optionally overrides/adds named computed functions. Existing built-in names are merged with your function map.

Catalog component names go into the renderer registry; non-catalog names form the shell registry. Preserve each catalog component's props/events, state bindings, accessibility and actions contract. A visual replacement cannot widen the server's allowed fields or authorize an action. `schema.view('HostComponent', props)` and custom page/widget components are escape hatches for host UI.

## Copy ownership via shadcn

```sh
node ace pupitre:ui add select --yes
# Equivalent single item:
npx shadcn@4 add https://pupitre.dev/r/select.json --yes
```

The site serves `/registry.json` and `/r/<name>.json`. Registry dependencies use full URLs and keep shared dependencies/imports consistent. Every payload file is `registry:file` with an explicit `~/inertia/components/pupitre/<source-path>` target. Shadcn resolves `~/` from the host root (or `--cwd` for the direct installer), independently of `components.json` aliases. Files retain their layout, including `inertia/components/pupitre/components/Select.tsx`, `primitives/index.tsx` and `icons.tsx`.

Do not pass `--path` to shadcn: it flattens files to their basenames and breaks relative imports. `pupitre:ui add` intentionally has no `--path` option. Register the copied component explicitly; copying does not automatically change the host registry.

Browse the item index at [https://pupitre.dev/registry.json](https://pupitre.dev/registry.json); individual payloads are `https://pupitre.dev/r/<name>.json`. Names are kebab-case, including hooks whose source filenames use underscores. In an initialized shadcn host, copy multiple items with `node ace pupitre:ui add select styles --yes`. `pupitre:ui` is the Ace command name and `add` is the operation; copying is explicit source ownership, not plugin installation.

For a hook item, use `node ace pupitre:ui add use-live-field --yes`.

`--registry` selects a different origin containing registry.json and r/*.json; `--yes` skips installer prompts; `--dry-run` validates item names and prints the command without copying (it still reads the registry index). The installer uses shadcn major 4. Use its Base UI component flavor; the Pupitre registry does not supply a Radix variant.

Copied files belong to your application. Review upstream changes before recopying. Keep `@rikology/pupitre-react` and the catalog package installed; registry copies replace visual source, not runtime/compiler contracts. For copied styles, add the `styles` item and import `components/pupitre/styles.css` in your host Tailwind CSS entry; otherwise keep the npm UI stylesheet import.
