---
title: Migrating from Filament
description: Translate Filament concepts into AdonisJS v7, Lucid and Inertia React.
---

Pupitre borrows Filament's declarative model, not its PHP runtime. Migrate your domain models, validation and policies to AdonisJS first, then move the admin definitions. These are API equivalents, not an automated source converter.

## Panel provider → panel module

**Filament (PHP)**

```php
return $panel
    ->id('admin')->path('admin')->authGuard('web')
    ->login()->registration()->passwordReset()
    ->discoverResources(in: app_path('Filament/Resources'), for: 'App\\Filament\\Resources');
```

**Pupitre (TypeScript)**

```ts
import { definePanel } from '@rikology/pupitre'
import PostResource from '#admin/resources/post_resource'

export default definePanel('admin')
  .path('/admin').guard('web')
  .login().registration().passwordReset()
  .resources([PostResource])
```

`authMiddleware` and middleware use one `.middleware([...])` list. Domains use `.domain()`. Brand name/logo/favicon become `.brand({...})`. Colors/fonts/dark mode and sidebar/content width become a validated `.theme(defineTheme({...}))`. The configure hook registers `indexAdmin()` to generate static discovery barrels; there is no request-time PHP class discovery.

## Resource class → resource builder

**Filament**

```php
class PostResource extends Resource {
    protected static ?string $model = Post::class;
    protected static ?string $recordTitleAttribute = 'title';
}
```

**Pupitre**

```ts
import { defineResource } from '@rikology/pupitre'
import Post from '#models/post'
import PostPolicy from '#policies/post_policy'

export default defineResource(Post)
  .slug('posts').label('Post').pluralLabel('Posts')
  .recordTitle('title').navigation({ group: 'Content', sort: 10 })
  .policy(PostPolicy)
```

Lucid attributes replace Eloquent attributes. `getEloquentQuery()` becomes `.scope((query, ctx) => ...)`; form/table/infolist are builder callbacks. `mutateFormDataBeforeFill` maps to `.fill()`, create/save mutation hooks to `.mutateBeforeCreate()`/`.mutateBeforeSave()`. Lifecycle hook names remain recognizable; custom persistence is `.create()`/`.update()` and receives a transaction. Preserve that transaction in your custom writes.

## Form components

**Filament**

```php
TextInput::make('title')->required()->maxLength(200),
Select::make('status')->options(['draft' => 'Draft', 'published' => 'Published'])->live(),
DateTimePicker::make('publishedAt')->visible(fn (Get $get) => $get('status') === 'published'),
```

**Pupitre**

```ts
.form((s) => [
  s.text('title').required().maxLength(200),
  s.select('status').options({ draft: 'Draft', published: 'Published' }).live(),
  s.dateTime('publishedAt').visible(({ get }) => get('status') === 'published'),
])
```

| Filament | Pupitre factory |
| --- | --- |
| TextInput email/password/numeric | `text`, `email`, `password`, `number` |
| Textarea / Hidden | `textarea` / `hidden` |
| Select / multiple Select | `select` / `multiSelect` |
| Checkbox / CheckboxList / Radio | `checkbox` / `checkboxList` / `radio` |
| Toggle / ToggleButtons | `toggle` / `toggleButtons` |
| DatePicker / DateTimePicker / TimePicker | `date` / `dateTime` / `time` |
| ColorPicker / TagsInput / KeyValue | `color` / `tags` / `keyValue` |
| RichEditor / MarkdownEditor / CodeEditor | `richEditor` / `markdownEditor` / `codeEditor` |
| FileUpload / Slider | `fileUpload` / `slider` |
| Repeater / Builder blocks | `repeater().schema(...)` / `builder().blocks([schema.block(...)])` |
| Grid / Section / Fieldset / Tabs | `grid` / `section` / `fieldset` / `tabs` + `tab` |
| Wizard / Group / Split | `wizard` + `step` / `group` / `split` |
| Placeholder / View | `placeholder` / `view` or `fragment` |

Validation is compiled to VineJS, not Laravel rules. Use `.rules([...])` for actual Vine rules, not PHP validation strings. Formatting/dehydration callbacks become `.format()`/`.dehydrate()`. The common method names are similar, but check the [schema signatures](/reference/api-schema/): there is no promise that every PHP method exists on every TypeScript builder.

## Tables, filters and list tabs

**Filament**

```php
$table->columns([
    TextColumn::make('title')->searchable()->sortable(),
    TextColumn::make('price')->money('USD'),
])->filters([
    SelectFilter::make('status')->options(['draft' => 'Draft']),
])->defaultSort('title');
```

**Pupitre**

```ts
import { table } from '@rikology/pupitre'

.table((t) => t.columns([
  table.text('title').searchable().sortable(),
  table.text('price').money('USD'),
]).filters([
  table.filter.select('status').options({ draft: 'Draft' }),
]).defaultSort('title', 'asc'))
```

Icon/Image/Color columns map to `table.icon/image/color`; inline Toggle/Select/TextInput/Checkbox map to `table.toggle/select/textInput/checkbox`. Custom view columns map to `table.custom(name, component)` or `table.fragment(component)`. Ternary and custom filters map to `table.filter.ternary/custom`; date range and trashed filters have dedicated factories. List tabs use `pages.list().tabs({...})`.

Grouping is `.groups([t.group('status').collapsible()])`; summaries use column `.summarize(['sum'])` or table `.summarize('price', ['sum'])`. Reorder is `.reorderable('position')`, polling `.poll('30s')`. Session-persisted table state becomes URL state. Multi-sort and a general QueryBuilder filter are intentionally not exposed.

## Actions and modals

**Filament**

```php
Action::make('publish')->requiresConfirmation()
    ->authorize('publish')
    ->action(fn (Post $record) => $record->update(['status' => 'published']));
```

**Pupitre**

```ts
import { action } from '@rikology/pupitre'
import Post from '#models/post'

const publish = action('publish').requiresConfirmation().can('publish')
  .handle(async ({ record, notify }) => {
    const post = record as Post
    post.merge({ status: 'published' })
    await post.save()
    notify?.success('Published').send()
  })
// resource.actions({ row: [publish] })
```

`.form([...])`/`.fillForm()` define a modal. `.modalHeading`, `.modalDescription`, `.modalWidth`, `.slideOver`, `.modal({ footerActions })` and `.modalSubmit(false)` map corresponding presentation controls. Bulk actions use `actions.bulk(name)`, then `.deselectAfter()`. Built-ins are `actions.create/edit/view/delete/replicate/restore/forceDelete/export/import`, with relation and bulk variants.

`successNotification` becomes the handler's `notify` builder; redirects/refresh use `.after(({ redirect, refresh }) => ...)`. `.async()` queues bulk/import through a jobs adapter, not a serialized request callback. Modal deep links use `.deepLinkable()`; rate limits `.rateLimit(maxAttempts, { per, by })` need the configured host limiter.

## Relation managers and nested resources

**Filament**

```php
class CommentsRelationManager extends RelationManager {
    protected static string $relationship = 'comments';
}
```

**Pupitre**

```ts
import { defineRelationManager, actions, table } from '@rikology/pupitre'
import Post from '#models/post'

export const comments = defineRelationManager(Post, 'comments')
  .form((s) => [s.textarea('body').required()])
  .table((t) => t.columns([table.text('body')]))
  .actions({ header: [actions.create()], row: [actions.edit(), actions.delete()] })
// PostResource.relations([comments])
```

Groups use `relationGroup(label, managers)`. Read-only managers use `.readOnly()`, badges `.badge((ctx, record) => ...)`. Attach/detach/associate/dissociate use action factories. Nested resource registration becomes parent `.nested([child])` plus child `.parent(parentModelOrResource, relation)`. Routes, ownership, policies and queries remain parent/tenant-scoped.

Simple resources use `pages.list().modals()`; no separate create/edit page routes are registered in that mode.

## Widgets

**Filament**

```php
Stat::make('Published', 42)->description('Ready')->chart([3, 5, 8]);
```

**Pupitre**

```ts
import { defineWidget, stat } from '@rikology/pupitre'

export const overview = defineWidget('overview')
  .stats(() => [stat('Published', 42).description('Ready').chart([3, 5, 8])])
  .span(2).sort(1).poll('30s')
```

This example uses a fixed value to show the equivalent API; real metrics belong in the server loader. Chart widgets use `.chart(type, loader)` and table widgets `defineWidget(name, Model).table(...)`. Dashboard filters are named option definitions on panel/page `.filters()`. Stats/chart queries in custom loaders need explicit tenant scoping. Header/footer page placement is `pages.<kind>().widgets([...]).footerWidgets([...])`.

## Custom pages and infolists

**Filament**

```php
class Settings extends Page {
    protected static string $view = 'filament.pages.settings';
}
```

**Pupitre**

```ts
import { definePage } from '@rikology/pupitre'

export const settings = definePage('settings')
  .path('/settings').title('Settings').component('SettingsPage')
// register SettingsPage in the host registry; panel.pages([settings])
```

A form-backed page uses `.form()`, `.fill(ctx)` and `.save(({ data, ctx }))`; header actions use `.actions([...])`. Its access gate is `.canAccess(ctx)`. There is no Blade template rendering hook: customize the React registry.

Infolists use resource `.infolist((s) => [...])`. Text/Icon/Image/Color/KeyValue/Repeatable/Code entries map to their `schema.*Entry` equivalents, plus `badgeEntry`. Layouts are shared with forms. Entry values are server-formatted; Markdown is sanitized.

## Policies and Shield

**Laravel policy**

```php
public function update(User $user, Post $post): bool {
    return $user->id === $post->author_id;
}
```

**AdonisJS Bouncer policy**

```ts
import { BasePolicy } from '@adonisjs/bouncer'
import User from '#models/user'
import Post from '#models/post'

export default class PostPolicy extends BasePolicy {
  update(user: User, post: Post) {
    return user.id === post.authorId
  }
}
// defineResource(Post).policy(PostPolicy)
```

Core abilities are viewAny/view/create/update/delete/restore/forceDelete and custom action abilities. Replicate/reorder/relation abilities have documented fallbacks when dedicated methods are absent; see the [authorization mapping](/guides/authorization/). Missing policies allow with a warning, so port them explicitly.

Use the official [Shield plugin](/plugins/shield/) for database-backed roles, grouped permission editing and generic Bouncer policies. Laravel permission tables/traits are not interchangeable: migrate grants to `<resource-slug>.<ability>`, add the User `roles` relation and run `shield:sync`. Explicit host policies remain authoritative; use `.policy()` or Shield's `except` for discovered policies you want to retain.

| Filament ecosystem concern | Pupitre integration |
| --- | --- |
| Shield / role-permission management | `@rikology/pupitre-shield`: `shield({ userModel, ... })` on the panel |
| Activity log / record audit history | [Audit](/plugins/audit/): `@rikology/pupitre-audit` + core `auditAdapter()` + configured `@rikology/adonisjs-audit-trail` capture/store |
| Broadcast notifications / realtime table refresh | [Transmit](/plugins/transmit/): `transmitRealtime()` in `config.pupitre.realtime` + `transmitRealtimeClient()` passed to React |

Audit's Activity resource denies access until a host permission callback or Audit/Activity policy permits it. Transmit delivers pings, not Laravel broadcast record payloads; the UI reloads authorized data.

## Notifications

**Filament**

```php
Notification::make()->title('Saved')->body('Changes applied')->success()->send();
```

**Pupitre, inside an action handler**

```ts
notify?.success('Saved').body('Changes applied').send()
```

Use `.actions([notificationAction('Open').url(...)])` for links and await `.sendToDatabase(user)` for persistence through a notifications adapter. Panel `.notifications({ interval })` enables the inbox; interval is milliseconds. Toast delivery and persisted inbox delivery are separate.

## Tenancy

**Filament**

```php
$panel->tenant(Team::class);
```

**Pupitre**

```ts
.tenancy({
  mode: 'url',
  model: () => import('#models/team'),
  ownership: 'team_id',
  tenantsForUser: async (user) => user.related('teams').query(),
})
```

Implement membership explicitly. URL and implicit modes replace implicit Laravel contracts, with an optional `TenancyAdapter` for host tenant packages. `.scope(false)` is an intentional global-resource escape hatch, not a substitute for policies. Tenant billing is not a core feature.

## Testing

**Filament / Livewire**

```php
livewire(CreatePost::class)->fillForm(['title' => 'Hello'])->call('create')->assertHasNoFormErrors();
```

**Pupitre / Japa**

```ts
import { submitForm, visitResource, assertSpecHas } from '@rikology/pupitre/testing'

const result = await submitForm('posts', 'create', { title: 'Hello' }, { user })
result.assertOk()
const page = await visitResource('posts', 'create', { user })
assertSpecHas(page.spec, { type: 'Text' })
```

Use `@rikology/pupitre-ui/testing` Playwright fixtures for rendered behavior. Port policy denial, tenancy isolation, hooks and validation cases as well as happy paths. Controllers/specs are the server test boundary; browser helpers use accessible labels rather than Livewire component state.

## Popular Filament plugins

| Filament plugin | Pupitre equivalent |
| --- | --- |
| Spatie media library plugin / Curator | [`@rikology/pupitre-media`](/plugins/media/) |
| filament-shield | [`@rikology/pupitre-shield`](/plugins/shield/) |
| filament-impersonate | panel `.impersonation()` + `actions.impersonate()` ([guide](/guides/impersonation/)) |
| Spatie settings plugin | [`@rikology/pupitre-settings`](/plugins/settings/) |
| Breezy browser sessions, authentication-log | panel `.sessions()` + `loginHistoryWidget()` ([auth guide](/guides/auth/)) |
| filament-excel | `actions.export().formats(['csv', 'xlsx'])` |
| environment-indicator | panel `.environmentIndicator()` |
| Advanced Tables saved views | `t.savedViews()` / `t.presetViews()` ([guide](/guides/saved-views/)) |
| filament-fullcalendar, guava/calendar | [`@rikology/pupitre-calendar`](/plugins/calendar/) |
| flowforge, filament-kanban | [`@rikology/pupitre-kanban`](/plugins/kanban/) |
| Spatie health plugin | [`@rikology/pupitre-health`](/plugins/health/) |
| filament-jobs-monitor | [`@rikology/pupitre-jobs`](/plugins/jobs/) |
| Spatie backup plugin | [`@rikology/pupitre-backup`](/plugins/backup/) |
| activity log plugins | [`@rikology/pupitre-audit`](/plugins/audit/) |

## Intentional architectural differences

- **Static discovery:** build initialization generates imports; no request-time filesystem scanning or PHP reflection.
- **Immutable TypeScript builders:** each fluent call returns a new builder. Keep/return the result.
- **Client-first reactivity:** safe closures lift to expressions and named computed functions. Request-dependent conditions remain server-static; unliftable watches require explicit `live({ server: true })`.
- **No eval/CSP exception:** callback source is not executed in the browser. Preserve CSP; do not enable unsafe-eval.
- **URL table state:** share/search/filter/group/tab views through URLs, not a persisted server session.
- **JSON action transport:** modal actions use authorized GET form specs and JSON POST results, not Livewire RPC or Inertia page redirects alone.
- **Server authorization and formatting:** browser descriptors are conveniences, never permission grants. UTC values, date formatting and VineJS validation remain server concerns.
- **Component ownership:** visual replacements live in the host registry; there is no Blade render-hook compatibility layer.

Read the [getting-started guide](/getting-started/) for host wiring and the [generated API reference](/reference/api-schema/) for the exact supported options before porting a large panel.
