# {{packageName}}

A Pupitre plugin contributing a documentation link to the Plugins navigation group.

## Install and use

```bash
npm install {{packageName}}
```

```ts
import { {{camelName}} } from '{{packageName}}'

// On your existing definePanel(...) builder:
.plugins([{{camelName}}({ documentationUrl: 'https://example.com/docs' })])
```

The plugin name is `{{name}}`; the npm package is `{{packageName}}`.
The optional `documentationUrl` defaults to https://pupitre.dev.
Pupitre merges navigation groups sharing the Plugins label.

## Development

Requires Node 24+. Run `npm install`, `npm test`, then `npm run build`.
The Japa test boots the real Pupitre manager and checks the contributed navigation.
Publish the resulting package with `npm publish --access public`.
