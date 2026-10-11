import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync, brotliCompressSync, constants } from 'node:zlib'

const root = fileURLToPath(new URL('../../', import.meta.url))
export const features = {
  tiptap: /@tiptap\//,
  codemirror: /@codemirror\//,
  charts: /WidgetChartBody/,
  markdown: /marked\/|dompurify\//,
  cropper: /ImageCropper/,
  transmit: /pupitre-transmit\/.*client|@adonisjs\/transmit-client/,
}

export function graph(manifest, roots, dynamic = false) {
  const visited = new Set()
  const pending = [...roots]
  while (pending.length) {
    const key = pending.pop()
    if (visited.has(key)) continue
    const chunk = manifest[key]
    if (!chunk) throw new Error(`Manifest references missing chunk: ${key}`)
    visited.add(key)
    pending.push(...(chunk.imports ?? []))
    if (dynamic) pending.push(...(chunk.dynamicImports ?? []))
  }
  return visited
}

export async function measure(assets) {
  const manifest = JSON.parse(await readFile(resolve(assets, '.vite/manifest.json'), 'utf8'))
  const entry = 'inertia/app.tsx'
  const initial = graph(manifest, [entry])
  const reachable = graph(manifest, [entry], true)
  // The selected Inertia page is also fetched at boot. Do not let a page-level
  // eager import evade the entry-only budget (especially the optional client).
  const admin = graph(manifest, ['inertia/pages/pupitre.tsx'])
  const cache = new Map()
  async function size(files) {
    const total = { raw: 0, gzip: 0, brotli: 0 }
    for (const file of new Set(files)) {
      if (!cache.has(file)) {
        const bytes = await readFile(resolve(assets, file))
        cache.set(file, {
          raw: bytes.length,
          gzip: gzipSync(bytes, { level: 9 }).length,
          brotli: brotliCompressSync(bytes, {
            params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
          }).length,
        })
      }
      for (const codec of Object.keys(total)) total[codec] += cache.get(file)[codec]
    }
    return total
  }
  const metrics = {
    initialJS: await size(
      [...initial].map((key) => manifest[key].file).filter((f) => /\.[cm]?js$/.test(f))
    ),
    initialCSS: await size(
      [...initial].flatMap((key) => [
        ...(manifest[key].css ?? []),
        ...(manifest[key].file.endsWith('.css') ? [manifest[key].file] : []),
      ])
    ),
  }
  const violations = []
  for (const [name, pattern] of Object.entries(features)) {
    const roots = Object.keys(manifest).filter((key) =>
      pattern.test(`${key} ${manifest[key].src ?? ''} ${manifest[key].name ?? ''}`)
    )
    if (!roots.length)
      violations.push(`${name}: no identifiable lazy chunk (feature coverage lost)`)
    for (const key of roots) {
      if (initial.has(key) || admin.has(key)) violations.push(`${name}: eager heavy feature ${key}`)
      if (!reachable.has(key))
        violations.push(`${name}: chunk is not dynamically reachable: ${key}`)
    }
    const group = graph(manifest, roots)
    metrics[name] = await size(
      [...group].filter((key) => !initial.has(key)).map((key) => manifest[key].file)
    )
  }
  let largestFile = ''
  metrics.largestLazy = { raw: 0, gzip: 0, brotli: 0 }
  for (const key of reachable) {
    if (initial.has(key)) continue
    const file = manifest[key].file
    if (!/\.[cm]?js$/.test(file)) continue
    const bytes = await size([file])
    if (bytes.raw > metrics.largestLazy.raw) {
      metrics.largestLazy = bytes
      largestFile = file
    }
  }
  return { metrics, violations, largestFile, initial: [...initial] }
}

export function checkBudgets(metrics, budgets) {
  const failures = []
  for (const [name, sizes] of Object.entries(metrics)) {
    for (const codec of ['gzip', 'brotli']) {
      const limit = budgets.limits?.[name]?.[codec]
      if (!Number.isFinite(limit) || limit < 0)
        failures.push(`${name}.${codec}: missing/invalid budget`)
      else if (sizes[codec] > limit)
        failures.push(`${name}.${codec}: ${sizes[codec]} > ${limit} bytes`)
    }
  }
  return failures
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const assets = resolve(root, 'apps/example/public/assets')
    const budgetsPath = process.argv[2] ?? resolve(root, 'tools/bundle-budget/budgets.json')
    const budgets = JSON.parse(await readFile(budgetsPath, 'utf8'))
    const result = await measure(assets)
    console.table(
      Object.entries(result.metrics).map(([group, bytes]) => ({
        group,
        'raw': bytes.raw,
        'gzip': bytes.gzip,
        'gzip budget': budgets.limits?.[group]?.gzip,
        'brotli': bytes.brotli,
        'brotli budget': budgets.limits?.[group]?.brotli,
      }))
    )
    console.log(`Largest lazy chunk: ${result.largestFile}`)
    const failures = [...result.violations, ...checkBudgets(result.metrics, budgets)]
    if (failures.length) throw new Error(failures.join('\n'))
    console.log('Bundle budgets and heavy-feature lazy boundaries passed.')
  } catch (error) {
    console.error(`Bundle budget failed:\n${error.message}`)
    process.exitCode = 1
  }
}
