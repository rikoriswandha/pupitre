# Pupitre — Checklist Parity Filament v4

Gate M3 = semua baris dengan target `M1`–`M3` berstatus ✅. Kolom "Pupitre" adalah API padanan; "—" berarti sengaja tidak ada dengan alasan di catatan. Status: ⬜ belum, 🟨 sebagian, ✅ selesai.

## Panel

| Filament v4 | Pupitre | Target | Status | Catatan |
| --- | --- | --- | --- | --- |
| `PanelProvider` / multi panel | `definePanel()` di `app/admin/panels/*.ts` | M1 | ✅ | |
| `->path()`, `->domain()` | `.path()`, `.domain()` | M1 | ✅ | domain membatasi host route group per panel |
| `->login()->registration()->passwordReset()->emailVerification()->profile()` | sama (chaining) | M2 | ✅ | WP17; lihat baris auth di bawah |
| `->authGuard()` | `.guard()` | M1 | ✅ | |
| `->middleware()`, `->authMiddleware()` | `.middleware()` | M1 | ✅ | satu array; `auth` termasuk |
| `->discoverResources()` dkk | build-time `indexAdmin` barrel | M1 | ✅ | sengaja beda (DESIGN) |
| `->navigationGroups()`, `->navigationItems()` | `.navigation([...])`, `nav.group()`, `nav.item()` | M2 | ✅ | sort, badge closure, filter `viewAny`/`canAccess`, external link, collapsible state |
| `->sidebarCollapsibleOnDesktop()`, `->topNavigation()` | theme file `sidebar: 'expanded'\|'collapsed'\|'top-nav'` | M3 | ✅ | Collapsed rail toggle persisten per panel; top navigation memakai dropdown grup |
| `->brandName()`, `->brandLogo()`, `->favicon()` | `.brand()` | M1 | ✅ | |
| `->colors()`, `->darkMode()`, `->font()` | `defineTheme()` + `.theme()` | M1/M3 | ✅ | Font, warna, mode gelap, radius, density, stylesheet same-origin/HTTPS dan CSS vars tervalidasi |
| `->globalSearch()`, `->globalSearchKeyBindings()` | `.globalSearch({ keyBinding })` + pencarian `cmd+k` | M2 | ✅ | `GET /_pupitre/search`; hanya resource yang searchable dan lolos policy |
| `->databaseNotifications()->databaseNotificationsPolling()` | `.notifications({ interval })` + database-channel adapter | M2 | ✅ | Tray polling, paginated inbox, and mark-read endpoints; database persistence is optional |
| `->tenant()`, `->tenantRoutePrefix()`, `->tenantMenu()`, `->tenantRegistration()`, `->tenantProfile()` | `.tenancy({...})` + `TenantSwitcher` | M2 | ✅ | URL/implicit mode, membership-aware routing, resource scoping, ownership fill, and global `.scope(false)` |
| `->plugins()` | `.plugins([...])` | M4 | ✅ | Hook register/extendResource/boot berurutan; kontribusi dan navigasi digabung oleh manager |
| `->strictAuthorization()` | `.strictAuthorization()` | post-1.0 | ✅ | Validasi cakupan policy setelah panel/plugin/resource selesai (`E_PUPITRE_MISSING_POLICY`), deny saat runtime untuk model tanpa policy, dilaporkan `pupitre:inspect` |
| Clusters (`$cluster`, `make:filament-cluster`) | `defineCluster()` + `resource/page.cluster()`; `make:cluster` | post-1.0 | ✅ | Ditemukan dari child; satu entri navigasi terotorisasi, route berprefix (termasuk tenancy URL dan nested), sub-navigasi sibling, breadcrumb, tabrakan slug ditolak saat boot |
| `->spa()` | — | — | — | Inertia sudah SPA |
| `->unsavedChangesAlerts()` | `Form.dirtyGuard` | M1 | ✅ | |
| `->maxContentWidth()` | theme `contentWidth` | M3 | ✅ | Lebar konten shell `md`–`7xl`, `full`, atau `screen` |
| `->renderHook()` | — | — | — | ganti komponen via registry |
| CSS hook classes `fi-*` + custom theme CSS | atribut `data-pupitre-<name>` + theme `stylesheet` | post-1.0 | ✅ | Selector stabil untuk shell, nav, section, tabs, wizard, form/field/control, tabel, kanban, button/badge/dialog; rule host tanpa layer menang atas utility Tailwind tanpa `!important` |
| `->userMenuItems()` | `.userMenu([...])` | M2 | ✅ | visible closure, sort, method, external link |
| `->breadcrumbs()` | otomatis; `.breadcrumbs(false)` | M1 | ✅ | |
| `->viteTheme()` | — | — | — | Tailwind host |

## Resource & pages

| Filament v4 | Pupitre | Target | Status | Catatan |
| --- | --- | --- | --- | --- |
| `Resource::$model` | `defineResource(Model)` | M1 | ✅ | |
| `$slug`, `$modelLabel`, `$pluralModelLabel`, `$navigationIcon/Group/Sort/Badge` | `.slug/.label/.pluralLabel/.icon/.navigation()` | M1 | ✅ | |
| `$recordTitleAttribute` | `.recordTitle()` | M1 | ✅ | |
| `getGloballySearchableAttributes()` | `.globallySearchable([...])` | M2 | ✅ | Dukungan kolom relasi dengan notasi titik |
| `getEloquentQuery()` | `.scope((q, ctx) => …)` | M1 | ✅ | |
| `form()`, `table()`, `infolist()` | `.form()/.table()/.infolist()` | M1 | ✅ | |
| `getPages()` List/Create/Edit/View | `.pages({ list, create, edit, view })` | M1 | ✅ | |
| `getRelations()` | `.relations([...])` | M3 | ✅ | Relation manager sebagai tab di halaman edit/view; data tabel per relasi deferred dengan prefix query |
| Nested resources (`$parentResource`) | `.nested([...])` + `.parent()` | M3 | ✅ | Route `/<parent>/:id/<child>/...`, breadcrumb parent, query terscope parent, FK diisi saat create |
| Soft deletes (`SoftDeletingScope`, `TrashedFilter`) | `.softDeletes()` + `t.filter.trashed()` | M3 | ✅ | query scope manual tanpa paket; restore/force delete memakai scoped record |
| `mutateFormDataBeforeFill/Create/Save` | `fill`, `mutateBeforeCreate`, `mutateBeforeSave` | M1 | ✅ | |
| `beforeCreate/afterCreate/beforeSave/afterSave/beforeDelete/afterDelete` | sama | M1 | ✅ | |
| `getRedirectUrl()` | `pages.create().redirectTo('edit')` | M1 | ✅ | |
| `handleRecordCreation/Update` | `.create(async …)`, `.update(async …)` override | M1 | ✅ | |
| Tabs di list page | `pages.list().tabs({...})` | M1 | ✅ | |
| Page widgets header/footer | `pages.list/create/edit/view().widgets([...])`, `.footerWidgets()` | M3 | ✅ | Deferred data, header/footer placement pada semua halaman resource, dan record-aware widget loading pada edit/view |
| Custom page class | `pages.edit().component('…')` | M1 | ✅ | escape hatch |
| `canAccess()`, policy auto-discovery | `.policy()` + default `<Model>Policy` | M1/M2 | ✅ | Abilities resource, custom abilities, `pupitre:inspect` closure-lift report dan deteksi indeks searchable yang hilang. |
| Resource sub-navigation (`getRecordSubNavigation`) | otomatis: edit/view/relations/nested | M3 | ✅ | `page.subNavigation` pada halaman record |
| Simple (modal) resources | `pages.list().modals()` | M3 | ✅ | create/edit sebagai action form di modal; tanpa route create/edit |

## Schema (form)

| Filament v4 | Pupitre | Target | Status |
| --- | --- | --- | --- |
| `TextInput` + `email/password/numeric/tel/url/mask/prefix/suffix/datalist/revealable` | `s.text` (+ `s.email`, `s.password`, `s.number`) | M1 | ✅ | `.tel()`, `.url()`, dan mask client-side; delimiter mask hanya tampilan, state tetap raw. |
| `Textarea` autosize | `s.textarea` | M1 | ✅ | `.autosize()` menumbuhkan tinggi dari isi, menghormati `rows`. |
| `Select` searchable/multiple/relationship/preload/createOptionForm | `s.select`, `s.multiSelect` | M1 (static) / M2 (options closure, relationship, create, actions) | ✅ | Policy `viewAny` dan `view` model terkait diperiksa saat validasi; opsi async tetap tenant-scoped. |
| `Checkbox`, `CheckboxList` | `s.checkbox`, `s.checkboxList` | M1 | ✅ |
| `Radio` dengan descriptions | `s.radio` | M1 | ✅ |
| `Toggle`, `ToggleButtons` | `s.toggle`, `s.toggleButtons` | M1 | ✅ |
| `DatePicker`, `DateTimePicker`, `TimePicker` + timezone | `s.date/dateTime/time` | M1 | ✅ (UTC round-trip, precedence user/panel/komponen, validasi DST) |
| `ColorPicker` | `s.color` | M1 | ✅ |
| `TagsInput` | `s.tags` | M1 | ✅ |
| `KeyValue` | `s.keyValue` | M1 | ✅ |
| `RichEditor` (toolbar, upload, mentions, merge tags, custom blocks) | `s.richEditor` + `.mergeTags()`, `.mentions([mentionProvider()])`, `.customBlocks([richBlock()])` | M1; extras post-1.0 | ✅ | Pencarian mention lewat endpoint options terotorisasi, mention palsu dibuang saat simpan, config block divalidasi Vine; `renderRichContent()` meng-escape nilai merge tag dan output block |
| `MarkdownEditor` | `s.markdownEditor` | M3 | ✅ | Toolbar, upload lampiran, preview Markdown tersanitasi di client; hasil infolist dirender server-side dengan allowlist HTML. |
| `CodeEditor` (v4 baru) | `s.codeEditor` | M3 | ✅ | CodeMirror 6 lazy dengan pemuatan bahasa sesuai pilihan. |
| `FileUpload` (image, editor, multiple, reorder, directory, visibility) | `s.fileUpload` | M1 (image editor M3) | ✅ | Crop, rotasi, flip, dan aspect ratio di client sebelum upload; validasi MIME/ukuran tetap di server. |
| `Slider` (v4 baru) | `s.slider` | M3 | ✅ | Slider native aksesibel dengan marks, nilai tunggal/range, step dan batas VineJS. |
| `Hidden` | `s.hidden` | M1 | ✅ |
| `Repeater` (reorderable, collapsible, cloneable, grid, simple, relationship) | `s.repeater` | M1 (relationship M3) | ✅ | `hasMany` disinkronkan transaksional; ID child diverifikasi sebagai milik parent dan urutan opsional disimpan. |
| Table repeater (`Repeater::table()`, `TableColumn`) | `s.repeater().table([s.tableColumn(label).width().alignment().markAsRequired()])` | post-1.0 | ✅ | Kolom posisional atau header turunan label, tabel semantik responsif, error per sel, reorder drag/keyboard |
| `Builder` blocks | `s.builder` | M3 | ✅ | Blok bertipe `{ _key, type, data }`; schema Vine mengikuti blok dan `_key` dibuang. |
| `Grid`, `Section`, `Fieldset`, `Tabs`, `Wizard`, `Group`, `Split` | `s.grid/section/fieldset/tabs/wizard/group/split` | M1 (minus wizard) / M3 | ✅ | Wizard menyimpan langkah di `/ui/wizard/<id>/step`; semua langkah ter-mount. |
| `Placeholder` | `s.placeholder` | M1 | ✅ |
| `ViewField`, `View` | `s.view()` (komponen host) / `s.fragment()` | M1 | ✅ |
| `live()`, `live(onBlur)`, `live(debounce)` | `.live()`, `.live({ onBlur })`, `.live({ debounce })` | M1 | ✅ |
| `afterStateUpdated` | `.afterStateUpdated()` client-first; `live({ server: true })` | M1 / M3 | ✅ | Watch server dengan debounce, otorisasi owner form, tenant-scoped record, dan whitelist patch `/data/**`. |
| `visible/hidden/disabled` closure | sama | M1 | ✅ |
| `dehydrated`, `dehydratedWhenHidden` | sama | M1 | ✅ |
| Validasi rules (`required`, `unique`, `rules`, `exists`, `regex`, `same`, `different`, `minLength`…) | VineJS compiler | M1 | ✅ |
| `columnSpan`, `columns` responsif | sama | M1 | ✅ |
| `hint`, `hintIcon`, `hintAction`, `helperText` | sama | M1 | ✅ | Ikon/tooltip/warna hint dan action di label memakai action runtime yang sama. |
| `extraAttributes`, `extraInputAttributes` | `.extraAttributes()` | M1 | ✅ |
| `default()` | `.default()` | M1 | ✅ |
| `formatStateUsing`, `dehydrateStateUsing` | `.format()`, `.dehydrate()` (server) | M1 | ✅ |
| `suffixAction`/`prefixAction` | `.suffixAction(action)` / `.prefixAction(action)` | M2 | ✅ | Action di field text dan select dikompilasi sebagai descriptor dan berjalan melalui form action protocol. |

## Infolist

| Filament v4 | Pupitre | Target | Status |
| --- | --- | --- | --- |
| `TextEntry` (badge, copyable, url, markdown, html, dateTime, money) | `s.textEntry` | M1 | ✅ | `.markdown()` mengubah Markdown di server menjadi HTML dengan allowlist `sanitizeHtml`; tidak menerima HTML dari client. |
| `IconEntry`, `ImageEntry`, `ColorEntry`, `KeyValueEntry`, `RepeatableEntry`, `CodeEntry` | padanan | M1 | ✅ |
| Layout sama dengan form | sama | M1 | ✅ |

## Table

| Filament v4 | Pupitre | Target | Status |
| --- | --- | --- | --- |
| `TextColumn` (searchable, sortable, limit, wrap, description, badge, money, dateTime, since, copyable, url) | `t.text` (termasuk `.wrap()`, `.badge()`) | M1 | ✅ |
| `IconColumn`, `ImageColumn` (circular, stacked), `ColorColumn` | `t.icon`, `t.image`, `t.color` | M1 | ✅ |
| `ToggleColumn`, `SelectColumn`, `TextInputColumn`, `CheckboxColumn` (inline edit) | `t.toggle/select/textInput/checkbox` + `PATCH column` | M3 | ✅ |
| `ViewColumn` / custom | `t.custom()`, `t.fragment()` | M1 | ✅ |
| Relasi dot notation, `counts`, `sum` | `t.text('author.name')`, `t.count('comments')` | M1/M3 | ✅ | dot notation dan relation count; summary aggregate ada di baris tabel |
| `SelectFilter`, `TernaryFilter`, `Filter` custom form, `QueryBuilder` | `t.filter.select/ternary/dateRange/custom`; `t.filter.queryBuilder(name).constraints([...])` + `qb` | M1; QueryBuilder post-1.0 | ✅ | QueryBuilder: constraint text/number/date/boolean/select/relationship, negasi, grup OR berisi rule AND, URL JSON tervalidasi (400), ekspor dan summary scope-safe (ADR-0025) |
| Filters layout dropdown/above/slideover; `persistFiltersInSession` | `.filtersLayout()`; persist di URL | M1 | ✅ |
| Sort default, multi-sort | `.defaultSort()`; `.multiSort(max = 3)` + `.defaultSort([...])` | M1; multi-sort post-1.0 | ✅ | `sort=title,-price`, link sort tunggal lama tetap valid, `sort=` menghapus default, kontrol keyboard "Add to sort" |
| Search global + per kolom | `q`, `columns[x][search]` | M1 / M3 | ✅ | pencarian individu mendukung kolom relasi melalui `whereHas` |
| Pagination opsi, `simple`, `all` | `.paginated([...])` | M1 | ✅ |
| Grouping + collapsible groups + summaries per grup | `.groups()`, `summarize()` | M3 | ✅ | groupBy URL dan summary dihitung untuk seluruh query terfilter |
| Summaries (sum/avg/count/range) | `.summarize([...])` | M3 | ✅ | nilai diformat server-side, lintas halaman |
| Reorderable | `.reorderable(column)`; scope-safe reorder API, drag + keyboard | M3 | ✅ |
| Polling | `.poll('30s')` (tab/dialog/editor aware) | M3 | ✅ |
| Column toggles, `toggleable(hiddenByDefault)` | sama (per-table localStorage) | M3 | ✅ |
| Striped, `recordUrl`, `recordClasses`, click action | `.striped()`, `.recordUrl(fn)`, `.rowClass(fn)` | M1 / M3 | ✅ | `rowClass` dievaluasi di server dan dibatasi ke class token aman |
| Grid/card layout (`contentGrid`, `Split`, `Stack`) | `t.layout.grid({ default, md, xl })` | M3 | ✅ |
| Empty state | `.emptyState()` | M1 | ✅ |
| Bulk actions, `deselectRecordsAfterCompletion`, `selectCurrentPageOnly` | `actions.bulk()`, `.deselectAfter()` | M1 | ✅ |
| Header actions, row actions, action groups | `.actions({ header, row, bulk })`, `action.group()` | M1 | ✅ |
| `deferLoading`, `deferFilters` | deferred prop `page.data`; `.deferFilters()` | M3 | ✅ | `deferLoading()` menggunakan deferred Inertia prop dan skeleton tabel; filter defer dikirim saat Apply |
| Export/Import (`ExportAction`, `ImportAction`) | `actions.export().formats(['csv', 'xlsx'])`, `actions.import()` CSV | M3; XLSX post-1.0 | ✅ | Query tabel + formatter server-side, batas sinkron, job progress/download privat, header mapping, VineJS per row, upsert, dan CSV baris gagal; writer XLSX streaming tanpa dependency |
| Custom data tables (`->records()`) | `t.records()`, `t.recordKey()`, `t.resolveRecord()` pada table widget tanpa model | post-1.0 | ✅ | State URL tervalidasi, pagination tanpa total, aksi row/header/bulk me-resolve row di server, fitur khusus Lucid ditolak saat definisi (ADR-0026) |

## Actions

| Filament v4 | Pupitre | Target | Status |
| --- | --- | --- | --- |
| Satu `Action` class di semua konteks | `action()` | M1 | ✅ |
| `requiresConfirmation`, modal heading/description/icon/width/slideOver | sama | M1 | ✅ |
| `form()`, `fillForm()`, `mountUsing` | `.form()`, `.fillForm()` | M1 | ✅ |
| `action(fn)` | `.handle()` | M1 | ✅ |
| `url()`, `openUrlInNewTab()` | sama | M1 | ✅ |
| `visible`, `hidden`, `disabled`, `authorize` | `.visible()`, `.can()` | M1 | ✅ |
| `successNotification`, `failureNotification`, `successRedirectUrl` | `notify.*`, `.after(redirect)` | M1 | ✅ |
| `keyBindings` | action header/bulk + actions di luar row; tidak di row context | M1 | ✅ | shortcut global untuk header/form/section; bulk mengikuti seleksi tabel |
| `ActionGroup` dropdown, `button/link/iconButton` | `action.group()`, `.variant()` | M1 | ✅ |
| `extraModalFooterActions`, `modalSubmitAction(false)` | `.modal({ footerActions })`, `.modalSubmit(false)` | M3 | ✅ | footer action mengirim data modal; submit/cancel dapat disembunyikan |
| Wizard di modal | schema wizard | M3 | ✅ | Footer Back/Next; submit pada langkah terakhir; respons 422 memilih langkah berisi error pertama. |
| Deep-link modal (`?action=`) | `.deepLinkable()` | M3 | ✅ | header dan row; server tetap authorize GET |
| `ReplicateAction`, `RestoreAction`, `ForceDeleteAction` | `actions.replicate/restore/forceDelete` | M3 | ✅ | kemampuan record `replicate` (fallback ability `create` perlu dicatat), `restore`, `forceDelete`; bulk restore/force delete tersedia |
| `AssociateAction`, `AttachAction`, `DetachAction`, `DissociateAction` | `actions.associate/attach/detach/dissociate()` pada relation manager | M3 | ✅ |
| Rate limiting action | `.rateLimit()` via `@adonisjs/limiter` | M3 | ✅ | scope panel/action + user/IP; 429 JSON |
| `.async()` (Pupitre) | bulk action + import melalui jobs adapter | M3 | ✅ | bulk ID dimuat ulang lewat scope aktif; tanpa adapter bulk/import berjalan sinkron |

## Widgets, pages, relation managers

| Filament v4 | Pupitre | Target | Status |
| --- | --- | --- | --- |
| `StatsOverviewWidget` + chart sparkline | `defineWidget().stats()` | M3 | ✅ |
| `ChartWidget` line/bar/pie/doughnut/radar/scatter | `.chart()` (line/bar/area/pie/doughnut/radar/scatter) | M3; radar/scatter post-1.0 | ✅ |
| `TableWidget` | `defineWidget(name, Model).table((t) => t.query(...).columns(...))` | M3 | ✅ | Query/pagination/sort memakai compiler dan server formatter tabel yang sama; UI memakai `DataTable` |
| Widget `pollingInterval`, `columnSpan`, `sort`, `filters` dashboard | `.poll()`, `.span()`, `.sort()`, dashboard `.filters()` | M3 | ✅ | Filter values URL-backed dan diteruskan ke loader widget |
| Custom widget Blade | `.component('…', loader?)` React host registry + `.actions([...])` + `useWidget()` | M3; loader/actions post-1.0 | ✅ |
| Dashboard page custom | `definePage().widgets([...]).filters([...])` dan panel `.widgets()` | M3 | ✅ | Grid yang sama pada dashboard panel maupun custom page |
| Custom `Page` dengan form/actions | `definePage().path().form().fill().save().actions()` + `.component()` | M2 | ✅ | |
| `RelationManager` (table + form, attach/detach) | `defineRelationManager()`; actions create/edit/delete/view + attach/detach/associate/dissociate | M3 | ✅ |
| Relation manager tabs, badge, `readOnly` | `.relations([...])`, `.badge()`, `.readOnly()` | M3 | ✅ |
| `RelationGroup` | `relationGroup(label, [...])` | M3 | ✅ |
| Nested resources | `.nested([...])` + child `.parent(ParentResource, 'relation')` | M3 | ✅ | Scoped query, create fills FK, parent breadcrumb, nested resource tidak muncul di nav |
| Resource sub-navigation | edit/view, relation tabs, nested resources | M3 | ✅ |
| Simple resources tanpa halaman create/edit | `pages.list().modals()` | M3 | ✅ | Create/edit dibuka sebagai ActionModal; route halaman create/edit tidak diregistrasi |

## Auth, notifikasi, lain-lain

| Filament v4 | Pupitre | Target | Status |
| --- | --- | --- | --- |
| Login, register, reset, verify, profile | `.login().registration().passwordReset().emailVerification().profile()` | WP17 | ✅ |
| MFA (v4: app + email) | TOTP app + recovery codes; email code — | M3 | ✅ | WP32a: enrollment, MFA challenge, one-use recovery codes; email MFA intentionally not in v1 |
| Passkeys | ya (WebAuthn) | M3 | ✅ | WP32a: profile registration/management, usernameless login; assertion satisfies MFA |
| Social login | `.social(['github', 'google'])` via Ally | M3 | ✅ (provider ID, verified-email fallback, MFA-aware callback) |
| Flash notifications | `notify.*` → toast | M1 | ✅ |
| Database notifications + actions di notif | adapter `notifications`; `notify.*().actions()` | M2 | ✅ | action persisted dan ditampilkan di tray/toast |
| Broadcast notifications (Echo) | `pupitre-transmit` + `/client` (SSE, bukan Echo) | M4 | ✅ | WP39: ping user + refresh tray; push tabel terscope panel/tenant; polling fallback tanpa client/channel |
| Global search + `getGlobalSearchResultDetails/Actions/Url` | `.globallySearchable()`, `.globalSearchDetails()` | M2 | ✅ | URL mengikuti ability `view`/`update`; maksimal 5 hasil/resource |
| Tenancy: `HasTenants`, scoping, `ownershipRelationship`, billing | `TenancyAdapter` + column / `@rikology/adonisjs-tenant` drivers; billing — | M2 | ✅ | |
| Shield plugin (roles/permissions) | `pupitre-shield` | M4 | ✅ | WP37: role CRUD, checkbox permission per resource, policy Bouncer cached per request, super-admin, sync idempotent, assignment User relation, helper custom page |
| Activity log plugin | `pupitre-audit` | M4 | ✅ | WP38: timeline view/edit, Activity read-only, filter event/subject/date, old/new detail, fail-closed policy dan subject links authorized |
| Settings plugin (spatie-settings) | `pupitre-settings` | post-1.0 | ✅ | Grup bertipe, form custom page, JSON, transaksi atomik, global/tenant, akses fail-closed |
| Multi-language (`->locales()`) | `.locale('en').locales(['en', 'id'])`, `t()`, kamus host/plugin | post-1.0 | ✅ | Inggris/Indonesia, preferensi user/session/Accept-Language, marker server lazy (ADR-0023), plural/interpolasi, pesan VineJS, CI coverage key literal |
| Theming custom CSS | theme file + CSS vars | M3 | ✅ | stylesheet host via `<link>` same-origin/HTTPS; tidak membuat inline `<style>` |
| Testing helpers (`livewire()` assertions) | `@rikology/pupitre/testing` + `@rikology/pupitre-ui/testing` | M3 | ✅ | `visitResource`/`submitForm`/`runAction`/`visitPage` lewat controller asli (authz, tenancy, hooks) + `assertSpecHas`/`assertVisible`; fixture Playwright dipakai e2e example |
| `make:*` commands | `make:panel <name>`; `make:resource`; `make:page`; `make:widget`; `make:relation-manager <Post> <comments>`; `make:cluster` | M2–M3 | ✅ | WP27/WP28 generator tests cover idempotent output |
| `make:plugin` | `make:plugin` + `create-pupitre-plugin` | M4 | ✅ | Modul lokal idempotent (`--force`); `--package [--dir]` menjalankan `npx @rikology/create-pupitre-plugin@<major>` untuk package plugin |
| Plugin ecosystem | `definePlugin`, `create-pupitre-plugin`, `defineCatalogExtension` + `defineField/Column/Entry` | M4; UI extension post-1.0 | ✅ | Kontrak plugin publik dan template package dengan kontribusi navigasi serta test manager Japa; plugin dapat mengirim field/kolom/entry React lewat catalog extension (`--with-ui`, ADR-0024) |

## Ekosistem plugin populer (post-1.0)

Diurutkan dari unduhan Packagist bulanan plugin Filament (Oktober 2026). Plugin yang sudah tercakup di tabel atas (Shield, settings, activity log, socialite, language switch, MFA) tidak diulang.

| Plugin Filament | Pupitre | Status | Catatan |
| --- | --- | --- | --- |
| spatie-laravel-media-library-plugin / Curator | `@rikology/pupitre-media` | ✅ | Resource Media (grid, upload, metadata), konversi `sharp` opsional, field `mediaPicker` lewat catalog extension, entry/kolom thumbnail, tenant-scoped dan fail-closed |
| stechstudio/filament-impersonate | panel `.impersonation()` + `actions.impersonate()` | ✅ | Di core karena butuh banner shell dan alur auth; ability `impersonate` fail-closed, MFA aktor, sesi dirotasi, keamanan profil dikunci selama impersonasi |
| filament-breezy (browser sessions) + rappasoft authentication-log | panel `.sessions()` + `loginHistoryWidget()` | ✅ | Token sesi ter-hash, revoke berlaku di request berikutnya, riwayat login tanpa menyimpan email tak dikenal, retensi lewat `pupitre:prune` |
| pxlrbt/filament-excel | `actions.export().formats(['csv', 'xlsx'])` | ✅ | |
| pxlrbt/filament-environment-indicator | panel `.environmentIndicator()` | ✅ | Badge teks + strip, default tampil di luar production |
| Advanced Tables (saved views, presets) | `t.savedViews()`, `t.presetViews([...])` | ✅ | View privat/publik per user/panel/tenant/tabel, default per user, `managePublicViews` fail-closed |
| saade/filament-fullcalendar, guava/calendar | `@rikology/pupitre-calendar` | ✅ | Bulan/minggu/hari/agenda, `resourceEvents()` terscope, reschedule terotorisasi dengan rollback, sadar timezone |
| relaticle/flowforge, mokhosh/filament-kanban | `@rikology/pupitre-kanban` | ✅ | Board per status dari resource, pindah kartu memeriksa `update` + `canMove`, urutan transaksional, keyboard/screen reader |
| shuvroroy/filament-spatie-laravel-health | `@rikology/pupitre-health` | ✅ | Memakai `@adonisjs/core/health`; cache + coalescing, meta disaring |
| croustibat/filament-jobs-monitor | `@rikology/pupitre-jobs` | ✅ | Lifecycle semua job `@adonisjs/queue` lewat tracing channels, payload terenkripsi + redaksi, retry/delete/prune terotorisasi |
| shuvroroy/filament-spatie-laravel-backup | `@rikology/pupitre-backup` | ✅ | SQLite/PostgreSQL/MySQL, unduhan privat, satu backup aktif, retensi, `backup:run`; restore sengaja manual |
| filament-spatie-laravel-translatable, filament-tree/adjacency-list, comments, approvals, Spotlight | — | ⬜ | Belum dikerjakan; permintaan lebih rendah |
