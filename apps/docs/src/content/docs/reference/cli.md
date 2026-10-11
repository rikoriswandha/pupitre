---
title: CLI reference
---

Commands are registered by the configure hook under `@rikology/pupitre/commands`. Run inside the host application as `node ace <command>`. The flags below are Pupitre-specific; standard Ace help remains available.

| Command | Arguments and flags | Behavior |
| --- | --- | --- |
| `pupitre:install` | `--panel=admin`, `--path=/admin`, `--auth=web` | Rerun host configure while preserving existing files |
| `make:panel <name>` | `--path` (default /name), `--guard=web` | Generate panel definition; no force flag |
| `make:resource <name>` | `--model` (default #models/name), `--from-migration`, `--force` | Generate from Lucid metadata or migration columns |
| `make:page <name>` | `--force` | Generate a custom page |
| `make:widget <name>` | `--type=stats` (stats/chart/table), `--model`, `--force` | Generate widget; model path for table widgets |
| `make:relation-manager <parent> <relation>` | `--model` (default parent model import), `--force` | Generate manager for the parent's named relationship |
| `make:plugin <name>` | `--force`, `--package`, `--dir` (package only) | Generate local plugin, or execute the versioned standalone package scaffolder |
| `pupitre:inspect [resource]` | `--json` | Policy/abilities, closure lifting and searchable-index diagnostics |
| `pupitre:routes` | No Pupitre flags | List registered routes grouped by panel |
| `pupitre:prune` | No Pupitre flags | Delete expired password-reset tokens and export files |
| `pupitre:ui add <names...>` | `--registry`, `--yes`, `--dry-run` | Validate kebab-case registry items and invoke shadcn@4 add; no `--path` option |
| `shield:sync` | `--user=<id-or-email>` | Create missing resource permissions and optionally attach each Shield panel's super-admin role |

Resource/relation generators and inspection/routes boot the app when needed, so configure host environment/database access first. Generation is not authorization: inspect generated fields and attach a policy before exposing them. Existing generated files are preserved unless the particular command supports and receives force.

`pupitre:inspect posts --json` is especially useful for client-first forms: it reports lifted expressions/computed expressions, server-static conditions and server watches rather than requiring you to guess why a callback is not reactive.

`npm create @rikology/pupitre-plugin <name> -- [--dir <path>] [--force]` is a standalone npm initializer, not an Ace command. See [plugins](/plugins/) for its package shape and naming rules.

`node ace make:plugin team-tools --package --dir packages/team-tools` executes `npx --yes @rikology/create-pupitre-plugin@<major> team-tools --dir packages/team-tools`, where `<major>` matches the installed Pupitre version. Without `--dir`, the Ace wrapper passes the normalized plugin name as the destination directory. It waits for the scaffolder and reports spawn/nonzero-exit failures; it does not merely print a command. `--force` applies to local generation, not the Ace package invocation.

UI payload files use `registry:file` with explicit `~/inertia/components/pupitre/<source-path>` targets. Hook item names are normalized to kebab-case even when their filenames contain underscores. Do not use the direct shadcn installer's `--path`: it flattens source paths and breaks imports.

`shield:sync` comes from `@rikology/pupitre-shield/commands`, registered by that package's configure hook, not the core command loader. Apply its migrations and register `shield({ userModel: ... })` first; see [Shield setup](/plugins/shield/). `pupitre:ui` is the command name and `add` is its operation argument, not a separate `pupitre:ui:add` command. Its dry run still reads the registry index.
