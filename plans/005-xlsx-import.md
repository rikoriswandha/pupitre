# Plan 005: Import the first XLSX worksheet through the existing CSV import pipeline

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`, unless a reviewer dispatched you and said they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4e076fa..HEAD -- packages/pupitre packages/pupitre-ui docs/ARCHITECTURE.md docs/WIRE_PROTOCOL.md docs/FILAMENT_PARITY.md apps/docs/src/content/docs plans/005-xlsx-import.md plans/README.md`
> This is only a committed-change signal. The tree already contains many uncommitted/untracked changes in core, UI, example/docs, and new backup/calendar/health/jobs/kanban/media plugins. ALWAYS compare every "Current state" excerpt against the LIVE files, including untracked files; a clean `git diff` is not sufficient. STOP on an excerpt mismatch before implementing. Record existing dirty paths and hunks; preserve them, do not reset/stash/overwrite them, and stage only this task's changes.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `4e076fa`, 2026-10-13

## Why this matters

Pupitre exports Excel workbooks but only imports CSV, forcing spreadsheet users to convert files and risking changed cell values during conversion. Add explicit XLSX opt-in to import actions and normalize the first worksheet to the same string-row representation used by CSV. The existing mapping, VineJS validation, tenant-scoped upsert, hooks, transactions and failed-row reporting must remain the single persistence pipeline. Reading hostile ZIP/XML is the principal risk; support a documented, bounded XLSX subset rather than claiming a general Excel engine.

## Current state

Paths below are relative to the repository root. Pupitre is an AdonisJS v7 + Inertia React admin framework using npm workspaces and Node 24. Source filenames are `snake_case.ts`; JSX components use `PascalCase.tsx`; relative TypeScript imports use `.js`, as the excerpts show.

### Existing format API and writer

- `packages/pupitre/src/builder/action.ts:128-135` — immutable export-only format setter:
  ```ts
  formats(value: readonly ('csv' | 'xlsx')[]): this {
    if (
      this.definition.builtin !== 'export' ||
      value.length === 0 ||
      value.some((format) => format !== 'csv' && format !== 'xlsx')
    )
      throw new E_PUPITRE_INVALID_ACTION_CONTEXT()
    return this.set({ exportFormats: [...new Set(value)] })
  ```
- `packages/pupitre/src/builder/action.ts:197-198` — public factories:
  ```ts
  export: (name = 'export') => createBuiltin(name, 'export'),
  import: (name = 'import') => createBuiltin(name, 'import'),
  ```
- `packages/pupitre/src/definition/action.ts:125-126,166-167` — definition and builder contracts:
  ```ts
  exportColumns?: readonly ExportColumnDefinition[]
  exportFormats?: readonly ('csv' | 'xlsx')[]
  // ActionBuilder:
  columns(value: readonly ExportColumnBuilder[]): this
  formats(value: readonly ('csv' | 'xlsx')[]): this
  ```
- `packages/pupitre/src/http/controllers/export_controller.ts:74-76` — default and server allowlist:
  ```ts
  const format = requestedFormat ?? action.exportFormats?.[0] ?? 'csv'
  if (!(action.exportFormats ?? ['csv']).includes(format))
    return errorJson(ctx, t('The requested export format is unavailable'), 422)
  ```
- `packages/pupitre/src/table/xlsx_stream.ts:130-138` — dependency-free writer entrypoint:
  ```ts
  export const xlsxContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

  /** One worksheet, inline strings and typed primitive cells; accepts backpressure-aware async rows. */
  export function createXlsxStream(
    records: Iterable<Record<string, unknown>> | AsyncIterable<Record<string, unknown>>,
    columns: readonly CsvColumn[],
    sheetName = 'Export'
  ): Readable {
    if (columns.length > 16_384) throw new Error('XLSX supports at most 16384 columns')
  ```
- `packages/pupitre/src/table/xlsx_stream.ts:51-52,59-63,94-98` — crucial ZIP detail:
  ```ts
  /** ZIP32 with raw deflate and data descriptors: worksheet bytes are never accumulated. */
  async function* zip(entries: Entry[]): AsyncGenerator<Buffer> {
  // local header:
  local.writeUInt32LE(0x04034b50)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(0x0808, 6)
  local.writeUInt16LE(8, 8)
  local.writeUInt16LE(name.length, 26)
  // after compressed bytes:
  const descriptor = Buffer.alloc(16)
  descriptor.writeUInt32LE(0x08074b50)
  descriptor.writeUInt32LE(checksum, 4)
  descriptor.writeUInt32LE(compressed, 8)
  descriptor.writeUInt32LE(size, 12)
  ```
  Local sizes are not populated: sequentially trusting local-file lengths cannot read this writer. The reader must use validated central-directory lengths, then validate the corresponding local headers and descriptors.
- `packages/pupitre/tests/helpers/xlsx.ts:13-14,26-30` — test-only central-directory reader, NOT a production-safe parser:
  ```ts
  /** Independent ZIP central-directory reader, deliberately not using the writer's CRC implementation. */
  export function readXlsx(bytes: Buffer): Record<string, string> {
  // ...
  assert.equal(bytes.readUInt32LE(local), 0x04034b50)
  const dataStart = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
  const contents = inflateRawSync(bytes.subarray(dataStart, dataStart + compressedSize))
  assert.equal(contents.length, bytes.readUInt32LE(offset + 24))
  assert.equal(checksum(contents), bytes.readUInt32LE(offset + 16))
  ```

### CSV-only request and worker pipeline

- `packages/pupitre/src/http/controllers/import_controller.ts:10-11,31`:
  ```ts
  import { parse as parseCsv } from 'csv-parse/sync'
  import { readUploadBytes } from '../../storage/upload_validation.js'
  // ...
  const CSV_MAX_BYTES = 10 * 1024 * 1024
  ```
- `packages/pupitre/src/http/controllers/import_controller.ts:82-106` — CSV parser wrapper signature and options (there is no separate CSV parser module today):
  ```ts
  async function uploadedCsv(
    ctx: HttpContext,
    maxRows = 100_000
  ): Promise<{ headers: string[]; rows: CsvRow[] }> {
    const file = ctx.request.file('file') as MultipartFile | null
    if (!file || !file.tmpPath || file.errors.length > 0)
      throw new Error(t('Upload a valid CSV file.'))
    if (file.size > CSV_MAX_BYTES) throw new Error(t('CSV files must be 10 MiB or smaller.'))
    const bytes = await readUploadBytes(file.tmpPath, CSV_MAX_BYTES)
    const parsed = parseCsv(bytes, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as CsvRow[]
    const headers = parsed.length > 0 ? Object.keys(parsed[0]!) : []
    if (headers.length === 0) throw new Error(t('The CSV file must include a header row.'))
    if (parsed.length > maxRows)
      throw new Error(
        t('CSV files cannot contain more than {count} rows on the synchronous path.', {
          count: maxRows,
        })
      )
    return { headers, rows: parsed }
  ```
- `packages/pupitre/src/http/controllers/import_controller.ts:280-285,292-300` — preview handler:
  ```ts
  export default class ImportController {
    async preview(ctx: HttpContext) {
      const { resource, action } = actionAndResource(ctx)
      if (!resource) return errorJson(ctx, t('Resource not found'), 404)
      if (!action || action.builtin !== 'import')
        return errorJson(ctx, t('Import action not found'), 404)
  // authorization remains before parsing
      try {
        const csv = await uploadedCsv(ctx)
        return ctx.response.json({
          headers: csv.headers,
          preview: csv.rows.slice(0, 5),
          fields: importFields(resource.definition.form ?? []),
        })
      } catch (error) {
        return errorJson(ctx, error instanceof Error ? error.message : t('Invalid CSV upload'), 422)
  ```
- `packages/pupitre/src/http/controllers/import_controller.ts:304-308,321-327,350-352` — store handler and row limits:
  ```ts
  async store(ctx: HttpContext) {
    const { resource, action } = actionAndResource(ctx)
    if (!resource) return errorJson(ctx, t('Resource not found'), 404)
    if (!action || action.builtin !== 'import')
      return errorJson(ctx, t('Import action not found'), 404)
  // ...
  const jobs = action.async ? manager.jobs : undefined
  const maxRows = jobs
    ? (config.exports?.maxAsyncRows ?? 100_000)
    : (config.exports?.maxSyncRows ?? 1000)
  let mapping: Record<string, string>
  try {
    csv = await uploadedCsv(ctx, maxRows)
  // ...
  if (!jobs) {
    const summary = await processImportRows(ctx, resource, action, csv.rows, csv.headers, mapping)
    return ctx.response.json(summary)
  ```
- `packages/pupitre/src/http/controllers/import_controller.ts:378-388` — queued source is always stored as CSV:
  ```ts
  const jobName = 'pupitre.import'
  const file = ctx.request.file('file') as MultipartFile | null
  if (!file?.tmpPath) return errorJson(ctx, t('Upload a valid CSV file.'), 422)
  const fileKey = `imports/${importId}.csv`
  try {
    await createPupitreStorage().put(
      fileKey,
      await readUploadBytes(file.tmpPath, CSV_MAX_BYTES),
      {
        contentType: 'text/csv; charset=utf-8',
        visibility: 'private',
  ```
- `packages/pupitre/src/http/controllers/import_controller.ts:135-139,152-155` — failed-row output:
  ```ts
  const id = randomUUID()
  const fileKey = `imports/${id}-failed.csv`
  const columns: CsvColumn[] = [
    ...headers.map((header) => ({ key: header, header })),
    { key: '_errors', header: t('Errors') },
  // ...
  await createPupitreStorage().put(fileKey, bytes, {
    contentType: 'text/csv; charset=utf-8',
    visibility: 'private',
  })
  ```
- `packages/pupitre/src/jobs/import_job.ts:51-62` — worker independently reparses CSV:
  ```ts
  const stream = await createPupitreStorage().getStream(payload.fileKey)
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const parsed = parseCsv(Buffer.concat(chunks), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[]
  const headers = parsed.length > 0 ? Object.keys(parsed[0]!) : []
  if (headers.length === 0) throw new Error(t('The queued CSV file has no header row'))
  ```
- `packages/pupitre/src/adapters/jobs.ts:2-5` — generic serializable payload contract:
  ```ts
  export interface JobsAdapter {
    dispatch(job: string, payload: Record<string, unknown>): Promise<void>
    register(job: string, handler: (payload: Record<string, unknown>) => Promise<void>): void
    initialize?(): Promise<void>
  ```
- `packages/pupitre/src/drivers/queue.ts:43-47` — driver forwards payload, so format belongs in the import job, not a driver-specific change:
  ```ts
  async dispatch(name, payload) {
    await initialize()
    if (!dispatchRegistered)
      throw new Error('Pupitre queue driver failed to register its job class')
    await dispatchRegistered({ name, payload })
  ```
- `packages/pupitre/src/define_config.ts:49,88`:
  ```ts
  exports?: { maxSyncRows?: number; maxAsyncRows?: number; retentionMinutes?: number }
  // defaults:
  exports: { maxSyncRows: 1000, maxAsyncRows: 100_000, retentionMinutes: 1440 },
  ```
  **Correction to the size-limit premise:** import bytes have a fixed 10 MiB ceiling, not a configurable import-size option. Preserve that ceiling; reuse existing configured row limits. Do not invent a new configuration API.
- `packages/pupitre/src/storage/upload_validation.ts:55-64` — bounded tempfile read:
  ```ts
  /** Default ceiling also covers editor and plugin-contributed upload fields. */
  export const DEFAULT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024

  /** Check the actual tempfile before allocating; never buffer more than the accepted size. */
  export async function readUploadBytes(path: string, maxBytes: number): Promise<Buffer> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new E_PUPITRE_UPLOAD_TOO_LARGE()
    const file = await open(path, 'r')
    try {
      const { size } = await file.stat()
      if (size > maxBytes) throw new E_PUPITRE_UPLOAD_TOO_LARGE()
  ```

### Client contract, tests and documentation

- `packages/pupitre/catalog/wire.ts:37-40` — descriptor currently carries export choices only:
  ```ts
  exportFormats: z
    .array(z.enum(['csv', 'xlsx']))
    .min(1)
    .optional(),
  ```
- `packages/pupitre/src/compiler/action_compiler.ts:282-284` — export-only projection:
  ```ts
  ...(action.builtin === 'export' && action.exportFormats
    ? { exportFormats: [...action.exportFormats] }
    : {}),
  ```
- `packages/pupitre-ui/src/components/ImportModal.tsx:274-278` — browser picker blocks XLSX:
  ```tsx
  type="file"
  aria-label={t('CSV file')}
  accept=".csv,text/csv"
  disabled={busy}
  onChange={chooseFile}
  ```
  End-to-end support requires this small contract/UI change; a server-only change would leave Excel unavailable in the normal admin journey.
- `packages/pupitre/tests/integration/http/imports.spec.ts:17-25,59,106` — existing controller test helper/cases to extend:
  ```ts
  async function uploadImport(
    fixture: TestApplication,
    cookie: string,
    csv: string,
    mapping: Record<string, string>
  ) {
    const body = new FormData()
    body.append('file', new File([csv], 'posts.csv', { type: 'text/csv' }))
    body.append('mapping', JSON.stringify(mapping))
  // existing tests:
  test('validates rows, upserts records, and downloads failed CSV', async ({ assert }) => {
  test('queues async imports and reports progress', async ({ assert }) => {
  ```
- `packages/pupitre/tests/integration/http/compiler_csv_import_audit.spec.ts:103-108,158-162` — hook-order and literal-apostrophe regressions:
  ```ts
  test('import matches create and update hook order and escapes failed rows', async ({
    assert,
  }) => {
    const posts = fixturePostResource.actions({
      header: [
        actions.import().resolveRecord(({ data }) => Post.findBy('slug', String(data.slug))),
  // ...
  // Imports deliberately retain the spreadsheet-safety apostrophe as data.
  const roundTrip = await upload(fixture, cookie, "title,slug\n'=SUM(A1),round-trip\n")
  assert.equal(roundTrip.status, 200)
  const imported = await Post.findByOrFail('slug', 'round-trip')
  assert.equal(imported.title, "'=SUM(A1)")
  ```
- `packages/pupitre/tests/unit/table/xlsx_stream.spec.ts:12-19` — generate writer fixtures in-test:
  ```ts
  const chunks: Buffer[] = []
  for await (const chunk of createXlsxStream(
    rows,
    keys.map((key) => ({ key, header: key })),
    name
  ))
    chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
  ```
- `packages/pupitre-ui/tests/ct/import_modal.spec.tsx:39-43,50-54` — preserve CSV UI and failure-download behavior:
  ```ts
  await fileInput.setInputFiles({
    name: 'posts.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Post title,Slug\nA post,a-post\n'),
  })
  // ...
  await page.getByRole('button', { name: 'Import CSV' }).click()
  await expect(page.getByText('1 created, 0 updated, 1 failed.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Download failed rows CSV' })).toHaveAttribute(
    'href',
    '/admin/_pupitre/exports/failed/download'
  ```
- `packages/pupitre/src/locales/id.ts:508,518` and `packages/pupitre/src/locales/client_keys.ts:99-100` — literal keys and Indonesian coverage:
  ```ts
  'The CSV file must include a header row.': 'File CSV harus memiliki baris judul kolom.',
  'Upload a valid CSV file.': 'Unggah file CSV yang valid.',
  // client_keys:
  'Unable to read the CSV file.',
  'Unable to import CSV rows.',
  ```
- `apps/docs/src/content/docs/guides/tables.md:148`:
  > Import reads CSV headers and maps them to scalar resource form fields. Each row is VineJS-validated with a separate transaction; the result counts created/updated/failed rows and supplies a failed-row CSV. `.resolveRecord(callback)` on `actions.import()` supports upsert; `.async()` enables queued import where configured.
  (The remainder of the existing line links to the action reference.)
- `docs/FILAMENT_PARITY.md:129` contains `actions.export().formats(['csv', 'xlsx'])`, `actions.import()` CSV, and `writer XLSX streaming tanpa dependency`; update the import side without removing the writer distinction.
- `docs/WIRE_PROTOCOL.md:315-316,326,328` specifies multipart `file` CSV, unchanged `{ headers, preview, fields }` and `{ total, created, updated, failed, failedRowsUrl? }` responses, serializable job identities/storage key/mapping rather than request closures, and failed-row CSV with `Errors`.
- `docs/ARCHITECTURE.md:43-46,52,97` requires core to have no React/UI imports; catalog imports Zod only; UI may use catalog/client hooks but not server code; committed registry payloads must match UI sources; layer order is `catalog → definition → builder → compiler → query/authz/tenancy → http`, with lower layers forbidden from importing upper layers. Keep the parser below HTTP and independent of request context.

### Reader decision evidence

`packages/pupitre/package.json:105-114` lists `@json-render/core`, `acorn`, `csv-parse`, `csv-stringify`, `file-type`, `marked`, `sanitize-html`, `zod`: no ZIP, XLSX or XML reader dependency. `tools/bundle-budget/index.mjs:31-38,114-119` measures the example's Vite assets/manifest and admin entry graph; it is a **client bundle** gate, not a server dependency install-size limit.

Read-only npm registry metadata queried on 2026-10-13 (`npm view <name> license dist.unpackedSize version`):

| Alternative | Version | License metadata | Unpacked package bytes (not gzip or transitive total) |
| --- | --- | --- | ---: |
| ZIP reader `fflate` | 0.8.3 | MIT | 796,742 |
| XML reader `fast-xml-parser` | 5.11.2 | MIT | 1,315,394 |
| Full workbook engine `exceljs` | 4.4.0 | MIT | 21,825,509 |

Registry license labels are preliminary checks; inspect the exact selected tarball's LICENSE and dependency licenses if the dependency alternative is ever approved. Never call unpacked size a measured browser bundle delta.

## Commands you will need

Run from the repository root. Existing scripts: core `packages/pupitre/package.json:94-99`; root `package.json:30-39`; UI `packages/pupitre-ui/package.json:53-57`; docs `apps/docs/package.json:7-14`.

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Core types | `npm run typecheck -w packages/pupitre` | exit 0, no type errors |
| Focused parser | `npm run quick:test -w packages/pupitre -- --files=tests/unit/table/import_parser.spec.ts` | all parser tests pass |
| Focused controller | `npm run quick:test -w packages/pupitre -- --files=tests/integration/http/imports.spec.ts` | CSV and XLSX tests pass |
| Import hook regressions | `npm run quick:test -w packages/pupitre -- --files=tests/integration/http/compiler_csv_import_audit.spec.ts` | existing CSV and new XLSX cases pass |
| Full core gate | `npm test -w packages/pupitre` | all tests pass and compiler/query/authz 85% coverage gates pass |
| UI types | `npm run typecheck -w packages/pupitre-ui` | exit 0, including CT types |
| UI tests | `npm test -w packages/pupitre-ui` | Japa and Playwright component suites pass |
| Registry generation | `npm run registry:build` | generated payloads match sources; review only intended generated changes |
| Registry gate | `npm run registry:check` | exit 0, no source/payload drift |
| Lint | `npm run lint` | exit 0 |
| Translation coverage | `npm run i18n:check` | exit 0, every new literal key covered in Indonesian |
| Docs gate | `npm run check -w apps/docs` | content preparation and Astro check exit 0 |
| Optional PostgreSQL | `npm run test:pg` | all tests pass against explicitly isolated test PostgreSQL |
| Conditional dependency bundle gate | `npm run bundle:budget` | exit 0 with current built example assets; no budget increases |

Do not install packages on the default dependency-free path. Do not run PostgreSQL tests against development/production data. The bundle command requires a current example production manifest; if a dependency alternative is approved, establish the operator's normal example build before measuring, not stale assets. No budget/build changes belong to this plan.

## Scope

**In scope** (only these files or explicitly listed generated groups may change):

- `packages/pupitre/src/definition/action.ts`
- `packages/pupitre/src/builder/action.ts`
- `packages/pupitre/src/compiler/action_compiler.ts`
- `packages/pupitre/catalog/wire.ts`
- `packages/pupitre/src/table/import_parser.ts` (create: shared dispatch/CSV normalization/limits)
- `packages/pupitre/src/table/xlsx_parser.ts` (create: bounded ZIP/XML worksheet reader)
- `packages/pupitre/src/http/controllers/import_controller.ts`
- `packages/pupitre/src/jobs/import_job.ts`
- `packages/pupitre/src/locales/id.ts`, `packages/pupitre/src/locales/client_keys.ts`
- `packages/pupitre/tests/unit/table/import_parser.spec.ts` (create)
- `packages/pupitre/tests/unit/table/xlsx_stream.spec.ts` (extend immutable format API tests)
- `packages/pupitre/tests/unit/actions/actions.spec.ts` (extend descriptor tests)
- `packages/pupitre/tests/integration/http/imports.spec.ts`
- `packages/pupitre/tests/integration/http/compiler_csv_import_audit.spec.ts`
- `packages/pupitre-ui/src/components/ImportModal.tsx`
- `packages/pupitre-ui/tests/ct/import_modal.spec.tsx`, `packages/pupitre-ui/tests/ct/stories/import_modal.story.tsx`
- UI registry generated files under `packages/pupitre-ui/registry/public/` and `packages/pupitre-ui/registry/registry.json`, only output attributable to the import modal source change. Never hand-edit payload contents.
- `apps/docs/src/content/docs/guides/tables.md`
- `apps/docs/src/content/docs/reference/api-action.md` (generated by content preparation; no manual type transcription)
- `docs/WIRE_PROTOCOL.md`, `docs/FILAMENT_PARITY.md`
- `packages/pupitre/CHANGELOG.md`
- `plans/005-xlsx-import.md` (execution decision/status notes), `plans/README.md` (status row only)

**Out of scope**:

- Export writer/controller changes; use the writer as fixture producer without weakening its ZIP/CSV formula-safety behavior.
- `processImportRows` validation/upsert/hooks/authorization/transaction behavior and failed-row encoding. Changing a neutral local type name is allowed, not its processing algorithm.
- Generic file-upload endpoints, storage drivers, queue driver/adapter interfaces, database schema, migrations, tenant/permission features.
- Plugins, example application features, unrelated dirty source or generated artifacts.
- Client-side XLSX parsing, arbitrary sheet selection, multiple-sheet imports, `.xls`, `.xlsm`, macros, chart/image/style rendering, date-format inference, formula evaluation.
- Dependencies or lockfile modifications on this path. If a dependency becomes necessary, STOP for a revised approved scope; do not silently install one.

## Git workflow

- Snapshot `git status --short` before working; record baseline dirty hunks, not just filenames. Compare live excerpts before branching.
- Branch: `advisor/005-xlsx-import`. Do not discard existing changes if switching/creating the branch is unsafe; STOP and report.
- Commit logical units with conventional messages, for example `feat(core): add bounded XLSX import parsing`, `feat(ui): enable configured XLSX import uploads`, `docs: document XLSX import limits`.
- Do not bulk-stage the dirty tree. Stage only task-owned hunks/new files; inspect the staged diff.
- Do NOT push or open a PR.

## Steps

### Step 1: Freeze parser and compatibility decisions

Record the following decision table in this plan's execution notes before writing source. Defaults below are the implementation contract, not choices for the executor to improvise:

1. **Format API:** `actions.import().formats(['csv', 'xlsx'])`; default stays CSV only. Keep `exportFormats` untouched; introduce distinct optional `importFormats` on definitions/descriptors. Accept the existing nonempty enum list and immutable deduplication behavior for import and export, reject `.formats()` on other builtins.
2. **Reader:** recommend a dependency-free ZIP32 + small structural XML tokenizer/walker using Node `zlib` raw inflate and CRC32. It fits the existing bounded single-worksheet import scope and avoids a workbook engine's installation weight. A local-header-only scanner is rejected because the writer uses data descriptors. Use central-directory metadata to delimit deflate bytes and cross-check local headers. XML parsing must be a real bounded structural walk, not a regex matching `<row>` or `<c>` bodies.
3. **Dependency alternative:** `fflate` plus `fast-xml-parser` offers maintained format primitives; `exceljs` offers broad Excel semantics but considerably larger package weight. Both still require caller-enforced limits and licenses/transitive review. If a safe structural XML walk/ZIP32 implementation cannot meet the adversarial tests without implementing a general-purpose format engine, STOP and request the dependency alternative with updated scope and measured package/license evidence. Do not proceed with an unsafe "minimal" parser or silently add dependencies. The client bundle gate does not measure server install size; keep any approved reader server-only and also report installed/transitive size.
4. **First worksheet:** resolve the first `<sheet>` in `xl/workbook.xml` through `xl/_rels/workbook.xml.rels`; `xl/worksheets/sheet1.xml` is the own-writer exemplar, NOT an assumption about every workbook's first sheet. Ignore subsequent worksheets without inflating them. Reject external relationship targets and normalized paths escaping the archive root.
5. **Cells:** first nonempty worksheet row is headers; trim headers and textual values like CSV; normalize sparse missing cells to `''`. Inline/shared strings, rich-text string runs, numeric cells and booleans are supported; concatenate string runs in document order. Return numeric lexical text and boolean `'true'`/`'false'`, all values strings. Preserve literal leading apostrophes. No date-style decoding: numeric Excel dates remain serial text; ISO string dates are strings. Reject formula cells (even cached ones), error cells and unsupported cell types with a clear translated error; never evaluate a formula or execute links.
6. **Limits:** 10 MiB compressed upload; at most 256 ZIP entries; 64 MiB aggregate inflated selected parts; 64 MiB worksheet XML; 8 MiB each metadata/shared-string part; at most 1,024 columns; at most 1,000,000 actual cells AND normalized row×header cells; at most 100,000 data rows, further restricted by existing sync/async config. Bound shared strings to 1,000,000 entries and XML nesting to 64. Enforce declared sizes before allocating AND actual output caps while inflating (`maxOutputLength` for bounded synchronous inflate); cap sparse indices before allocating. Count headers in cell limits. Never rely on worksheet dimension declarations.
7. **Errors/headers:** reject empty/duplicate XLSX headers and data extending beyond the header width; ignore wholly blank rows. Require headers plus at least one nonempty data row, matching today's effective CSV acceptance. CSV parser options/duplicate-header behavior stay unchanged.
8. **Upload validation:** `.xlsx` extension plus the exact spreadsheet MIME (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) plus valid ZIP/XLSX structure. Check the original multipart Content-Type metadata, not only a generic ZIP sniff result. CSV's existing accepted clients remain accepted. Extension/MIME alone never proves XLSX. No `.xls`/`.xlsm` aliases.
9. **Queued format:** new payloads carry explicit `format`; derive/check format against the generated storage-key extension and current action's allowed formats in the worker. Existing queued payloads with no format may be inferred as CSV ONLY when their key ends in `.csv` (necessary deployment compatibility, not a new public deprecated API). Persist raw source bytes privately, not re-serialized rows, and re-run the bounded parser in the worker.
10. **Failed rows:** always CSV. This keeps the existing download contract and formula-injection protection, represents normalized values plus `Errors` without rebuilding Excel formatting, and avoids multiplying error-file formats.

Open questions for the maintainer, with defaults above: whether wider Excel semantics (formatted dates/cached formulas/ZIP64) are desired; whether 64 MiB inflated XML and 1M cells meet typical hosts' memory limits; whether legacy already-queued CSV work must survive deployment. These are deliberately answered by the narrow defaults in this plan. If an actual host requires broader semantics, STOP rather than widening silently. No ADR is required for this implementation direction; if review explicitly requires one, request a scope amendment and use the next free number after 0029.

**Verify**: `npm run typecheck -w packages/pupitre` → unchanged baseline exits 0. If baseline fails, report the preexisting failure; do not repair unrelated work.

### Step 2: Extend builder and descriptor format contracts

In `definition/action.ts`, add optional `importFormats?: readonly ('csv' | 'xlsx')[]`. In `builder/action.ts`, extend the existing `.formats()` context guard to import OR export, preserving enum/nonempty validation, immutable clones and deduplication; write the appropriate property, never both. In `catalog/wire.ts`, add optional nonempty enum-array `importFormats` next to `exportFormats`; catalog stays Zod-only. In `action_compiler.ts`, project only import actions' configured list, cloning it. Default import kind stays direct; no export picker logic is changed.

Extend `xlsx_stream.spec.ts` builder tests and `unit/actions/actions.spec.ts` descriptor tests: CSV default unchanged, CSV+XLSX and XLSX-only accepted, duplicate formats deduped, earlier builder unchanged, empty/invalid lists and unrelated actions rejected, import/export metadata not mixed. Add Indonesian error keys in the same step if any new `t()` calls are introduced; don't leave later steps blocked by known missing translations.

**Verify**: `npm run typecheck -w packages/pupitre && npm run quick:test -w packages/pupitre -- --files=tests/unit/table/xlsx_stream.spec.ts && npm run quick:test -w packages/pupitre -- --files=tests/unit/actions/actions.spec.ts` → exits 0; existing export tests and new import metadata tests pass.

### Step 3: Implement bounded format-neutral and XLSX parser modules

Create `src/table/import_parser.ts` with internal exported types `ImportFormat = 'csv' | 'xlsx'`, `ImportRow = Record<string,string>`, `ParsedImport = { headers: string[]; rows: ImportRow[] }` and `parseImport(bytes: Buffer, format: ImportFormat, options: { maxRows: number }): ParsedImport`. Keep it independent of `HttpContext`; retain `csv-parse/sync` options exactly. Move CSV byte/row normalization out of controller/job into this module rather than leaving two parsers. Put named, documented XLSX limit constants in `xlsx_parser.ts` or `import_parser.ts` (one source of truth).

Implement `parseXlsx` in `xlsx_parser.ts` to the Step 1 decisions. Validate EOCD (including legal ZIP comment), disk/count consistency, all bounds/offset arithmetic and central-directory termination before reading any entry. Support ZIP32 stored and deflated entries, with/without data descriptors; reject encryption, ZIP64, multidisk, unsupported methods, duplicate normalized entry names, traversal, overlapping ranges, truncated headers/data, CRC/size mismatches. No extraction to disk, subprocesses or external network. Read only workbook/rels/selected worksheet/optional sharedStrings parts; count aggregate actual inflated bytes. Use fatal UTF-8 decoding, reject DOCTYPE/ENTITY declarations, unsupported entities and malformed XML; support standard named and numeric XML entities, namespace prefixes, self-closing nodes and rich-text runs. Reject malformed references/huge row-column indices before sparse padding and use prototype-safe header-to-row mapping. Preserve value text without applying spreadsheet styles.

Create `tests/unit/table/import_parser.spec.ts`. Generate a small workbook in-test via `createXlsxStream`, using the collection pattern quoted above; this proves data-descriptor compatibility. Add test-local ZIP/XML fixture constructors for sharedStrings, sparse and reordered worksheets, comments and malformed/adversarial archives (not a production helper imported from tests). Do not validate the parser using only its own encoders: own-writer fixtures plus independently assembled ZIP fixtures cover separate failure modes. Use injectable/internal test limits or tiny crafted inputs to test boundaries without allocating a bomb.

**Verify**: `npm run typecheck -w packages/pupitre && npm run quick:test -w packages/pupitre -- --files=tests/unit/table/import_parser.spec.ts` → exits 0; all normal and rejection cases in Test plan pass without crashes/unbounded output.

### Step 4: Route preview through action-aware upload validation

Replace `uploadedCsv` with `uploadedImport(ctx, action, maxRows)`; return the parsed shape plus validated `format` and bounded original bytes needed by store. Select format by extension/MIME metadata and validate against `action.importFormats ?? ['csv']`; use `readUploadBytes` and the existing 10 MiB ceiling, then `parseImport`. Do not depend on a user-submitted format to override the file or allowlist. Translate public parser/upload errors with literal English keys and Indonesian entries; do not expose raw XML/zlib internals.

Keep preview authorization/nested-parent checks in their current positions before reading bytes. Preview response remains `{ headers, preview: rows.slice(0,5), fields }`; no format-specific response branch. Use existing preview ceiling (100K rows) plus XLSX hard ceilings; do not change store-config selection while previewing. Extend `imports.spec.ts` with authenticated preview requests and wire-shape assertions.

**Verify**: `npm run quick:test -w packages/pupitre -- --files=tests/integration/http/imports.spec.ts && npm run i18n:check` → CSV preview unchanged; XLSX preview returns 200/string rows, disabled/mismatched/malformed/oversized uploads return 422, unauthorized request remains denied.

### Step 5: Use the same parser for sync and queued imports

In `store`, pass the actual action and selected sync/async row cap to `uploadedImport`; use neutral local names. Preserve mapping/skip filtering, allowed fields and calls to `processImportRows`. Replace CSV-specific mapping error wording with neutral import-header wording and translations, but do not change validation behavior.

Queue source storage uses `imports/${importId}.${format}`, exact matching MIME and private visibility. Reuse the already validated bounded bytes; do not reread/upload an unvalidated replacement. Include `format` in `pupitre.import` payload, retaining locale/tenant/user/action/params/query/mapping. Keep failure-status updates and cleanup.

In `import_job.ts`, validate payload format/key/action format availability before parsing; support only the narrowly described already-queued `.csv` payload case. Bound storage stream accumulation to 10 MiB before `Buffer.concat`, then call shared `parseImport` with configured `maxAsyncRows`. Preserve owner/tenant checks, fresh authorization, nested-parent guard, progress callbacks, `processImportRows`, status updates and finally-delete semantics. No queue-driver changes are required.

Extend `imports.spec.ts`'s helper to accept bytes/name/MIME without duplicating requests. Run CSV and XLSX cases for create/update/skip/invalid row/failed-row CSV; queued XLSX success/progress and queued malformed/disallowed format cleanup; capture a deferred payload to assert raw XLSX/private key/MIME/explicit format and replay under changed action configuration. Extend `compiler_csv_import_audit.spec.ts` for XLSX hook order and literal-apostrophe preservation. Include tenant/authorization negatives so the new format cannot bypass the existing pipeline.

**Verify**: `npm run typecheck -w packages/pupitre && npm run quick:test -w packages/pupitre -- --files=tests/integration/http/imports.spec.ts && npm run quick:test -w packages/pupitre -- --files=tests/integration/http/compiler_csv_import_audit.spec.ts` → all pass, failed rows remain `text/csv` and existing hook/scope behavior is unchanged.

### Step 6: Enable XLSX in the existing import modal without changing its workflow

`ImportModal.tsx` already receives an `ActionDescriptor`. Build file-input `accept` from `action.importFormats ?? ['csv']`: `.csv,text/csv` and/or `.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Rename local `uploadCsv`/`previewCsv` helpers and state labels where format-neutral (not wire APIs). Keep preview mapping, summary, polling, cancellation/focus/keyboard behavior and failed-row download text unchanged.

Preserve CSV-only labels for default actions so existing clients/tests stay compatible. For explicit XLSX-only or mixed actions, use literal translated labels describing Excel or CSV/Excel; do not construct dynamic `t()` keys. Switch generic preview/import error fallback strings where they otherwise misidentify XLSX. Update `locales/client_keys.ts` and `locales/id.ts` for every added literal key. Add a formats prop to `import_modal.story.tsx` to exercise default, mixed and XLSX-only actions; add CT assertions for accept allowlists, XLSX File submitted unchanged to preview/store, mapping and failed-row CSV link. Client must never import server parser/zlib.

Run `registry:build`; retain import-modal payload updates only. Because the baseline is dirty, generator changes belonging to someone else's source are not permission to stage them; if attributable output cannot be separated, STOP and coordinate rather than reverting their edits.

**Verify**: `npm run typecheck -w packages/pupitre-ui && npm test -w packages/pupitre-ui && npm run registry:build && npm run registry:check && npm run i18n:check` → all exit 0; default CSV CT/a11y/polling behavior and XLSX cases pass, registry content matches source.

### Step 7: Document supported XLSX semantics and finish gates

Update `guides/tables.md` import paragraph/example to show `.formats(['csv','xlsx'])`, CSV-only default, first workbook sheet, string normalization, 10 MiB compressed/64 MiB inflated/1M-cell ceilings, existing configured row limits, supported types and explicit formula/date/ZIP64 exclusions. State XLSX values are not formatted Excel display values and failed rows remain CSV; preserve the formula-safety apostrophe note.

Update `FILAMENT_PARITY.md:129` import capability, and `WIRE_PROTOCOL.md` descriptor/import multipart sections with `importFormats`, extension/MIME checks, unchanged response shapes, queued format identity and failure CSV contract. Add an Unreleased Added entry to core `CHANGELOG.md`. Docs `check` invokes content preparation and regenerates public action references; keep only definition-related generated changes. Do not hand-edit generated API declarations or unrelated docs.

**Verify**: `npm run typecheck -w packages/pupitre && npm test -w packages/pupitre && npm run lint && npm run i18n:check && npm run check -w apps/docs && npm run registry:check` → all exit 0. Optional `npm run test:pg` only with isolated test DB. If the maintainer explicitly approved a reader dependency under a revised plan, also require `npm run bundle:budget` with fresh example assets and unchanged budgets, exact-version LICENSE review and server install-size report; otherwise package/lockfile diff must be absent.

## Test plan

Write explicit assertions, not merely "does not throw".

- **Builder/compiler:** extend `tests/unit/table/xlsx_stream.spec.ts` and `tests/unit/actions/actions.spec.ts` for import defaults, `.formats()` allowlist/context/dedup/immutability, Zod descriptor parsing and unchanged export metadata.
- **Parser:** `tests/unit/table/import_parser.spec.ts`: own-writer inline strings, Unicode/entities/quote preservation, numeric negative and boolean string normalization, null/missing/sparse cells and columns after Z; independently assembled shared/rich strings; first sheet not named sheet1 and ignored second worksheet; header/data validation, missing shared-string index, empty/duplicate XLSX headers and blank rows; CSV options stay byte-for-byte equivalent on BOM/quoted comma/blank row/ragged-column cases.
- **ZIP/XML rejection:** valid stored/deflated archives and descriptors/comments; truncated EOCD/central/local/data, wrong CRC/sizes, duplicate/traversal/overlap/encrypted/ZIP64 entries, non-ZIP bytes; inflate cap (actual as well as declared), too many entries/rows/columns/cells/shared strings, huge sparse indices, invalid UTF-8/XML/entity/DTD, excessive nesting, external relationships, formulas/error cells, missing worksheet/workbook/rels. Each asserts a controlled parser error and bounded behavior.
- **Controller:** extend `tests/integration/http/imports.spec.ts`, not a standalone mock-only controller. SQLite app pattern is its `createTestApp`/login/FormData/teardown. Test CSV default, XLSX opt-in/mixed/XLSX-only, preview wire validation and five-row slice, wrong extension/MIME, malformed archive, compressed/row limits, disabled format, missing file, empty mapping/skip; create/update/required-field failure, out-of-scope resolver and denied create/update/nested-parent. Assert no records/jobs for rejected uploads.
- **Queue:** same integration file: explicit payload format, private raw XLSX key/MIME, shared parser worker path, unchanged progress, action-format revocation, malformed persisted bytes, stream size cap, tenant/user mismatch and source cleanup on success/failure. Existing no-format `.csv` payload handled deliberately; missing-format `.xlsx` fails. Keep existing CSV queue case.
- **Hooks/security:** extend `compiler_csv_import_audit.spec.ts`'s existing hook-order/failed-CSV/apostrophe test for XLSX; do not alter the expected lifecycle sequence or remove the CSV case.
- **UI:** extend `pupitre-ui/tests/ct/import_modal.spec.tsx` using its story; default CSV accept/labels remain, mixed/XLSX-only accept/labels render, selected XLSX is the multipart File in both requests, mapping/summary/polling/failure CSV remain. Existing modal focus and polling suites must still pass.
- **Translation/docs:** all new public keys have literal English `t()` calls and Indonesian dictionary entries; `i18n:check` and Astro docs check pass. Do not translate headers/record cell contents as interface keys.

## Done criteria

ALL must hold:

- [ ] `actions.import().formats(['csv','xlsx'])` and `['xlsx']` compile; unit assertions show immutable metadata and CSV-only default.
- [ ] Shared `parseImport` and bounded `parseXlsx` modules exist with the specified string-row contract; all parser/adversarial cases above pass, including a real in-test own-writer XLSX with data descriptors.
- [ ] XLSX preview, synchronous import and actual registered queued worker tests pass; controller/job no longer independently call `csv-parse/sync`.
- [ ] Failed rows from XLSX are downloadable CSV with `Errors`, private ownership checks, `nosniff`, existing formula-safety behavior and original hook/upsert/tenant semantics.
- [ ] Browser import modal uses server-provided `importFormats`; CT tests cover default CSV, mixed and XLSX-only selection. No server ZIP/XML code appears in client imports.
- [ ] `npm run typecheck -w packages/pupitre`, `npm test -w packages/pupitre`, `npm run typecheck -w packages/pupitre-ui`, `npm test -w packages/pupitre-ui`, `npm run lint`, `npm run i18n:check`, `npm run registry:check`, and `npm run check -w apps/docs` all exit 0.
- [ ] Guide, wire protocol, parity and Unreleased changelog reflect the opt-in, limitations and failed-row CSV; generated action reference/registry changes match source.
- [ ] No dependency/lockfile/budget changes on the recommended path. If a dependency was approved in a revised scope, exact-version license/transitive-size evidence and fresh-assets `bundle:budget` exit 0 are recorded instead.
- [ ] `git diff` and staged changes contain only task-owned hunks from Scope; baseline user edits are preserved. `plans/README.md` status updated (or reviewer ownership noted).

## STOP conditions

Stop and report, do not improvise, if:

- Any live Current state excerpt differs, even when committed diff is empty, or you cannot safely separate task changes from the user's dirty work.
- The own-writer workbook cannot be read without changes to the writer. Fix the parser's descriptor/central-directory handling; do not simplify the writer for the test.
- Bounds checks cannot prevent expansion/indices/XML traversal allocations before they happen, or the parser cannot structurally reject malformed XML/DTD/external targets. Request the maintained-reader alternative rather than suppressing tests.
- Required inputs include ZIP64/encrypted files/macros/multiple sheets/Excel styles or formulas contrary to the documented subset. Do not claim these are supported or use fake date/formula conversion.
- A dependency appears necessary: STOP with candidate license, installed/transitive weight and rationale; package/lockfile changes need revised approval. `bundle:budget` passing alone is not a license or server-size review.
- Upload metadata available in the current Adonis version cannot safely distinguish exact declared MIME/extension, or XLSX is rejected upstream before the controller; inspect the actual request/bodyparser contract and report the needed out-of-scope adjustment.
- Queue payload/storage identity cannot be validated or existing queued deployments require compatibility beyond missing-format `.csv` jobs. Do not guess formats from arbitrary bytes/keys.
- A step's verification fails twice after a reasonable in-scope fix, PostgreSQL isolation is uncertain, or any required change lies outside Scope. Report the exact failure and baseline distinction; never fix unrelated plugins/CI as part of this plan.

## Maintenance notes

- XLSX reader and writer have different trust boundaries: writer receives application values; reader receives hostile ZIP/XML. Never promote the test helper's unlimited inflate into production or remove parser bounds for "compatibility".
- Changing import limits, numeric/boolean normalization or the first-sheet rule must update unit/controller/queue tests and guide/wire documentation together. Keep a single format dispatcher shared by request and worker.
- Format lists are both presentation metadata and a server allowlist. Recheck them after queued definitions are reloaded; file picker acceptance alone is not authorization or file validation.
- Copy-owned UI consumers must update their ImportModal registry copy to expose Excel. CSV defaults and wire responses remain compatible; publish notes should mention the component update.
- Review central/local ZIP agreement, actual inflate limits, sparse allocation guards, prototype-safe header mapping, XML entity handling and first-sheet relationships especially carefully. Errors should be localized and controlled, not raw parser internals.
- Deliberately deferred: full Excel engine semantics, style/date formatting, formulas and alternate worksheet selection. These are product expansions, not unfinished parts of this deliverable; approval requires a revised contract and renewed parser/dependency security review.
