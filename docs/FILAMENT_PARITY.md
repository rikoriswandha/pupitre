# Pupitre — Checklist Parity Filament v4

Gate M3 = semua baris dengan target `M1`–`M3` berstatus ✅. Kolom "Pupitre" adalah API padanan; "—" berarti sengaja tidak ada dengan alasan di catatan. Status: ⬜ belum, 🟨 sebagian, ✅ selesai.

## Panel

| Filament v4 | Pupitre | Target | Status | Catatan |
| --- | --- | --- | --- | --- |
| `PanelProvider` / multi panel | `definePanel()` di `app/admin/panels/*.ts` | M1 | ⬜ | |
| `->path()`, `->domain()` | `.path()`, `.domain()` | M1 | ⬜ | domain M2 |
| `->login()->registration()->passwordReset()->emailVerification()->profile()` | sama (chaining) | M2 | ⬜ | |
| `->authGuard()` | `.guard()` | M1 | ⬜ | |
| `->middleware()`, `->authMiddleware()` | `.middleware()` | M1 | ⬜ | satu array; `auth` termasuk |
| `->discoverResources()` dkk | build-time `indexAdmin` barrel | M1 | ⬜ | sengaja beda (DESIGN) |
| `->navigationGroups()`, `->navigationItems()` | `.navigation([...])` | M2 | ⬜ | |
| `->sidebarCollapsibleOnDesktop()`, `->topNavigation()` | theme file `sidebar: 'expanded'\|'collapsed'\|'top-nav'` | M3 | ⬜ | |
| `->brandName()`, `->brandLogo()`, `->favicon()` | `.brand()` | M1 | ⬜ | |
| `->colors()`, `->darkMode()`, `->font()` | `.theme()` + theme file | M1/M3 | ⬜ | |
| `->globalSearch()`, `->globalSearchKeyBindings()` | `.globalSearch({ keyBinding })` | M2 | ⬜ | |
| `->databaseNotifications()->databaseNotificationsPolling()` | `.notifications({ driver, interval })` | M2 | ⬜ | |
| `->tenant()`, `->tenantRoutePrefix()`, `->tenantMenu()`, `->tenantRegistration()`, `->tenantProfile()` | `.tenancy({...})` | M2 | ⬜ | |
| `->plugins()` | `.plugins([...])` | M4 | ⬜ | API stabil sejak M1 |
| `->spa()` | — | — | — | Inertia sudah SPA |
| `->unsavedChangesAlerts()` | `Form.dirtyGuard` | M1 | ⬜ | |
| `->maxContentWidth()` | theme file `contentWidth` | M3 | ⬜ | |
| `->renderHook()` | — | — | — | ganti komponen via registry |
| `->userMenuItems()` | `.userMenu([...])` | M2 | ⬜ | |
| `->breadcrumbs()` | otomatis; `.breadcrumbs(false)` | M1 | ⬜ | |
| `->viteTheme()` | — | — | — | Tailwind host |

## Resource & pages

| Filament v4 | Pupitre | Target | Status | Catatan |
| --- | --- | --- | --- | --- |
| `Resource::$model` | `defineResource(Model)` | M1 | ⬜ | |
| `$slug`, `$modelLabel`, `$pluralModelLabel`, `$navigationIcon/Group/Sort/Badge` | `.slug/.label/.pluralLabel/.icon/.navigation()` | M1 | ⬜ | |
| `$recordTitleAttribute` | `.recordTitle()` | M1 | ⬜ | |
| `getGloballySearchableAttributes()` | `.globallySearchable([...])` | M2 | ⬜ | |
| `getEloquentQuery()` | `.scope((q, ctx) => …)` | M1 | ⬜ | |
| `form()`, `table()`, `infolist()` | `.form()/.table()/.infolist()` | M1 | ⬜ | |
| `getPages()` List/Create/Edit/View | `.pages({ list, create, edit, view })` | M1 | ⬜ | |
| `getRelations()` | `.relations([...])` | M3 | ⬜ | |
| Nested resources (`$parentResource`) | `.nested([...])` + `.parent()` | M3 | ⬜ | |
| Soft deletes (`SoftDeletingScope`, `TrashedFilter`) | `.softDeletes()` + `t.filter.trashed()` | M3 | ⬜ | |
| `mutateFormDataBeforeFill/Create/Save` | `fill`, `mutateBeforeCreate`, `mutateBeforeSave` | M1 | ⬜ | |
| `beforeCreate/afterCreate/beforeSave/afterSave/beforeDelete/afterDelete` | sama | M1 | ⬜ | |
| `getRedirectUrl()` | `pages.create().redirectTo('edit')` | M1 | ⬜ | |
| `handleRecordCreation/Update` | `.create(async …)`, `.update(async …)` override | M1 | ⬜ | |
| Tabs di list page | `pages.list().tabs({...})` | M1 | ⬜ | |
| Page widgets header/footer | `pages.edit().widgets([...])`, `.footerWidgets()` | M3 | ⬜ | |
| Custom page class | `pages.edit().component('…')` | M1 | ⬜ | escape hatch |
| `canAccess()`, policy auto-discovery | `.policy()` + default `<Model>Policy` | M1/M2 | ⬜ | |
| Resource sub-navigation (`getRecordSubNavigation`) | otomatis: edit/view/relations/nested | M3 | ⬜ | |
| Simple (modal) resources | `pages.list().modals()` | M3 | ⬜ | create/edit sebagai action form |

## Schema (form)

| Filament v4 | Pupitre | Target | Status |
| --- | --- | --- | --- |
| `TextInput` + `email/password/numeric/tel/url/mask/prefix/suffix/datalist/revealable` | `s.text` (+ `s.email`, `s.password`, `s.number`) | M1 | ⬜ |
| `Textarea` autosize | `s.textarea` | M1 | ⬜ |
| `Select` searchable/multiple/relationship/preload/createOptionForm/native | `s.select`, `s.multiSelect` | M1 (static) / M2 (relationship, create) | ⬜ |
| `Checkbox`, `CheckboxList` | `s.checkbox`, `s.checkboxList` | M1 | ⬜ |
| `Radio` dengan descriptions | `s.radio` | M1 | ⬜ |
| `Toggle`, `ToggleButtons` | `s.toggle`, `s.toggleButtons` | M1 | ⬜ |
| `DatePicker`, `DateTimePicker`, `TimePicker` + timezone | `s.date/dateTime/time` | M1 | ⬜ |
| `ColorPicker` | `s.color` | M1 | ⬜ |
| `TagsInput` | `s.tags` | M1 | ⬜ |
| `KeyValue` | `s.keyValue` | M1 | ⬜ |
| `RichEditor` (toolbar, upload) | `s.richEditor` | M1 | ⬜ |
| `MarkdownEditor` | `s.markdownEditor` | M3 | ⬜ |
| `CodeEditor` (v4 baru) | `s.codeEditor` | M3 | ⬜ |
| `FileUpload` (image, editor, multiple, reorder, directory, visibility) | `s.fileUpload` | M1 (image editor M3) | ⬜ |
| `Slider` (v4 baru) | `s.slider` | M3 | ⬜ |
| `Hidden` | `s.hidden` | M1 | ⬜ |
| `Repeater` (reorderable, collapsible, cloneable, grid, simple, relationship) | `s.repeater` | M1 (relationship M3) | ⬜ |
| `Builder` blocks | `s.builder` | M3 | ⬜ |
| `Grid`, `Section`, `Fieldset`, `Tabs`, `Wizard`, `Group`, `Split` | `s.grid/section/fieldset/tabs/wizard/group/split` | M1 (minus wizard) / M3 | ⬜ |
| `Placeholder` | `s.placeholder` | M1 | ⬜ |
| `ViewField`, `View` | `s.view()` (komponen host) / `s.fragment()` | M1 | ⬜ |
| `live()`, `live(onBlur)`, `live(debounce)` | `.live()`, `.live({ onBlur })`, `.live({ debounce })` | M1 | ⬜ |
| `afterStateUpdated` | `.afterStateUpdated()` client-first; `live({ server: true })` | M1 / M3 | ⬜ |
| `visible/hidden/disabled` closure | sama | M1 | ⬜ |
| `dehydrated`, `dehydratedWhenHidden` | sama | M1 | ⬜ |
| Validasi rules (`required`, `unique`, `rules`, `exists`, `regex`, `same`, `different`, `minLength`…) | VineJS compiler | M1 | ⬜ |
| `columnSpan`, `columns` responsif | sama | M1 | ⬜ |
| `hint`, `hintIcon`, `hintAction`, `helperText` | sama | M1 | ⬜ |
| `extraAttributes`, `extraInputAttributes` | `.extraAttributes()` | M1 | ⬜ |
| `default()` | `.default()` | M1 | ⬜ |
| `formatStateUsing`, `dehydrateStateUsing` | `.format()`, `.dehydrate()` (server) | M1 | ⬜ |
| `suffixAction`/`prefixAction` | `.suffixAction(action)` | M2 | ⬜ |

## Infolist

| Filament v4 | Pupitre | Target | Status |
| --- | --- | --- | --- |
| `TextEntry` (badge, copyable, url, markdown, html, dateTime, money) | `s.textEntry` | M1 | ⬜ |
| `IconEntry`, `ImageEntry`, `ColorEntry`, `KeyValueEntry`, `RepeatableEntry`, `CodeEntry` | padanan | M1 | ⬜ |
| Layout sama dengan form | sama | M1 | ⬜ |

## Table

| Filament v4 | Pupitre | Target | Status |
| --- | --- | --- | --- |
| `TextColumn` (searchable, sortable, limit, wrap, description, badge, money, dateTime, since, copyable, url) | `t.text`, `t.badge` | M1 | ⬜ |
| `IconColumn`, `ImageColumn` (circular, stacked), `ColorColumn` | `t.icon`, `t.image`, `t.color` | M1 | ⬜ |
| `ToggleColumn`, `SelectColumn`, `TextInputColumn`, `CheckboxColumn` (inline edit) | padanan | M3 | ⬜ |
| `ViewColumn` / custom | `t.custom()`, `t.fragment()` | M1 | ⬜ |
| Relasi dot notation, `counts`, `sum` | `t.text('author.name')`, `t.count('comments')` | M1/M3 | ⬜ |
| `SelectFilter`, `TernaryFilter`, `Filter` custom form, `QueryBuilder` | `t.filter.select/ternary/dateRange/custom` | M1; QueryBuilder — | ⬜ | QueryBuilder tidak di v1 |
| Filters layout dropdown/above/slideover; `persistFiltersInSession` | `.filtersLayout()`; persist di URL | M1 | ⬜ |
| Sort default, multi-sort | `.defaultSort()`; multi-sort — | M1 | ⬜ |
| Search global + per kolom | `q`, `columns[x][search]` | M1 / M3 | ⬜ |
| Pagination opsi, `simple`, `all` | `.paginated([...])` | M1 | ⬜ |
| Grouping + collapsible groups + summaries per grup | `.groups()`, `summarize()` | M3 | ⬜ |
| Summaries (sum/avg/count/range) | `.summarize([...])` | M3 | ⬜ |
| Reorderable | `.reorderable()` | M3 | ⬜ |
| Polling | `.poll()` | M3 | ⬜ |
| Column toggles, `toggleable(hiddenByDefault)` | sama (localStorage) | M3 | ⬜ |
| Striped, `recordUrl`, `recordClasses`, click action | `.striped()`, `.recordUrl()`, `.rowClass()` | M1 | ⬜ |
| Grid/card layout (`contentGrid`, `Split`, `Stack`) | `t.layout.grid()` | M3 | ⬜ |
| Empty state | `.emptyState()` | M1 | ⬜ |
| Bulk actions, `deselectRecordsAfterCompletion`, `selectCurrentPageOnly` | `actions.bulk()`, `.deselectAfter()` | M1 | ⬜ |
| Header actions, row actions, action groups | `.actions({ header, row, bulk })`, `action.group()` | M1 | ⬜ |
| `deferLoading`, `deferFilters` | deferred prop `page.data`; `.deferFilters()` | M3 | ⬜ |
| Export/Import (`ExportAction`, `ImportAction`) | `actions.export()`, `actions.import()` CSV | M3 | ⬜ | hanya CSV |

## Actions

| Filament v4 | Pupitre | Target | Status |
| --- | --- | --- | --- |
| Satu `Action` class di semua konteks | `action()` | M1 | ⬜ |
| `requiresConfirmation`, modal heading/description/icon/width/slideOver | sama | M1 | ⬜ |
| `form()`, `fillForm()`, `mountUsing` | `.form()`, `.fillForm()` | M1 | ⬜ |
| `action(fn)` | `.handle()` | M1 | ⬜ |
| `url()`, `openUrlInNewTab()` | sama | M1 | ⬜ |
| `visible`, `hidden`, `disabled`, `authorize` | `.visible()`, `.can()` | M1 | ⬜ |
| `successNotification`, `failureNotification`, `successRedirectUrl` | `notify.*`, `.after(redirect)` | M1 | ⬜ |
| `keyBindings` | sama | M1 | ⬜ |
| `ActionGroup` dropdown, `button/link/iconButton` | `action.group()`, `.variant()` | M1 | ⬜ |
| `extraModalFooterActions`, `modalSubmitAction(false)` | `.modal({ footerActions })`, `.modalSubmit(false)` | M3 | ⬜ |
| Wizard di modal | schema wizard | M3 | ⬜ |
| Deep-link modal (`?action=`) | `.deepLinkable()` | M3 | ⬜ |
| `ReplicateAction`, `RestoreAction`, `ForceDeleteAction` | `actions.replicate/restore/forceDelete` | M3 | ⬜ |
| `AssociateAction`, `AttachAction`, `DetachAction`, `DissociateAction` | relation manager bawaan | M3 | ⬜ |
| Rate limiting action | `.rateLimit()` via `@adonisjs/limiter` | M3 | ⬜ |
| `.async()` (Pupitre) | bulk action via jobs adapter | M3 | ⬜ | tambahan |

## Widgets, pages, relation managers

| Filament v4 | Pupitre | Target | Status |
| --- | --- | --- | --- |
| `StatsOverviewWidget` + chart sparkline | `defineWidget().stats()` | M3 | ⬜ |
| `ChartWidget` line/bar/pie/doughnut/radar/scatter | `.chart()` (line/bar/area/pie/doughnut) | M3 | ⬜ | radar/scatter — |
| `TableWidget` | `.table()` | M3 | ⬜ |
| Widget `pollingInterval`, `columnSpan`, `sort`, `filters` dashboard | sama | M3 | ⬜ |
| Custom widget Blade | `.component('…')` React host | M3 | ⬜ |
| Dashboard page custom | `definePage('dashboard')` | M3 | ⬜ |
| Custom `Page` dengan form/actions | `definePage()` | M2 | ⬜ |
| `RelationManager` (table + form, attach/detach) | `defineRelationManager()` | M3 | ⬜ |
| Relation manager tabs & badge, `readOnly` | sama | M3 | ⬜ |
| `RelationGroup` | `.relations([group([...])])` | M3 | ⬜ |

## Auth, notifikasi, lain-lain

| Filament v4 | Pupitre | Target | Status |
| --- | --- | --- | --- |
| Login, register, reset, verify, profile | WP13 | M2 | ⬜ |
| MFA (v4: app + email) | TOTP app + recovery codes; email code — | M3 | ⬜ | email MFA tidak di v1 |
| Passkeys | ya (WebAuthn) | M3 | ⬜ | Filament tidak punya bawaan |
| Social login | via Ally | M3 | ⬜ | Filament via plugin |
| Flash notifications | `notify.*` → toast | M1 | ⬜ |
| Database notifications + actions di notif | adapter `notifications` | M2 | ⬜ |
| Broadcast notifications (Echo) | `pupitre-transmit` | M4 | ⬜ |
| Global search + `getGlobalSearchResultDetails/Actions/Url` | `.globallySearchable()`, `.globalSearchResult()` | M2 | ⬜ |
| Tenancy: `HasTenants`, scoping, `ownershipRelationship`, billing | adapter tenancy; billing — | M2 | ⬜ |
| Shield plugin (roles/permissions) | `pupitre-shield` | M4 | ⬜ |
| Activity log plugin | `pupitre-audit` | M4 | ⬜ |
| Multi-language (`->locales()`) | — | post-1.0 | — |
| Theming custom CSS | theme file + CSS vars | M3 | ⬜ |
| Testing helpers (`livewire()` assertions) | `@rikology/pupitre/testing` | M3 | ⬜ |
| `make:*` commands | `make:resource/page/widget/relation-manager/panel/plugin` | M2–M4 | ⬜ |
| Plugin ecosystem | `definePlugin`, `create-pupitre-plugin` | M4 | ⬜ |
