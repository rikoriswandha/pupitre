# Pupitre

Pupitre is a Filament-inspired admin framework for **AdonisJS v7 and Inertia React**. Describe Lucid resources, reactive forms, tables and server-authorized actions with typed TypeScript builders; Pupitre handles routes, VineJS validation and scoped queries while you keep ownership of your React components. Optional plugins add roles and permissions, audit activity and realtime updates.

## Requirements

- Node.js **24+**
- An AdonisJS **v7** application with **Inertia React**, Lucid, a configured database and session authentication
- Host models, migrations and Bouncer policies for the resources you expose

## Quick start

Inside your AdonisJS application:

```sh
node ace add @rikology/pupitre
node ace make:resource Post
```

The installer registers Pupitre and publishes the starter panel, frontend registry and host migrations. **Review the generated migrations against your existing user schema before running `node ace migration:run`.**

For an existing `Post` model and `PostPolicy`, define `app/admin/resources/post_resource.ts`:

```ts
import { defineResource, table, actions } from '@rikology/pupitre'
import Post from '#models/post'
import PostPolicy from '#policies/post_policy'

export default defineResource(Post)
  .policy(PostPolicy)
  .recordTitle('title')
  .form((s) => [s.text('title').required().maxLength(200)])
  .table((t) => t.columns([table.text('title').searchable().sortable()]))
  .actions({ row: [actions.edit(), actions.delete()] })
```

Register the resource in your panel, configure the host auth model, then start `node ace serve --hmr`. See the [getting-started guide](apps/docs/src/content/docs/getting-started.md) for the complete panel and authentication setup. A resource without a policy allows access and logs a warning: define your authorization before exposing it.

## Packages

| Package | Role |
| --- | --- |
| [@rikology/pupitre](packages/pupitre) | Server builders, compiler, routes, queries and optional adapters |
| [@rikology/pupitre-react](packages/pupitre-react) | React runtime and Inertia action transport |
| [@rikology/pupitre-ui](packages/pupitre-ui) | Default Base UI components and copyable shadcn registry |
| [@rikology/pupitre-shield](packages/pupitre-shield) | Database-backed roles, permissions and Bouncer integration |
| [@rikology/pupitre-audit](packages/pupitre-audit) | Read-only activity and record history backed by audit-trail |
| [@rikology/pupitre-transmit](packages/pupitre-transmit) | Authenticated AdonisJS Transmit realtime integration |
| [@rikology/create-pupitre-plugin](packages/create-pupitre-plugin) | Publishable plugin scaffolder |

## Documentation and contributing

- [Documentation — pupitre.dev](https://pupitre.dev)
- [Development, setup and contributing](docs/DEVELOPMENT.md)
- [Testing strategy](docs/TESTING.md)
- [Example AdonisJS application](apps/example)
- [Security policy and vulnerability reporting](SECURITY.md)

## License

MIT, as declared in the published [package metadata](packages/pupitre/package.json).
