import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isBuiltin } from 'node:module'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

export function runtimeImports(source) {
  const file = ts.createSourceFile(
    'runtime.js',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  )
  const imports = new Set()
  const add = (node) => {
    if (node && ts.isStringLiteralLike(node)) imports.add(node.text)
  }
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier)
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      add(node.arguments[0])
    ts.forEachChild(node, visit)
  }
  visit(file)
  return [...imports]
}

export async function checkDependencies(pkgDir) {
  const pkg = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8'))
  const declared = new Set([
    pkg.name,
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ])
  const errors = []
  const pending = [join(pkgDir, 'build')]
  const resolutions = []
  let files = 0
  while (pending.length) {
    const dir = pending.pop()
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        pending.push(path)
        continue
      }
      if (!/\.[cm]?js$/.test(entry.name)) continue
      files++
      for (const specifier of runtimeImports(await readFile(path, 'utf8'))) {
        if (isBuiltin(specifier) || /^(?:\.|\/|file:)/.test(specifier)) continue
        const name = specifier.startsWith('@')
          ? specifier.split('/').slice(0, 2).join('/')
          : specifier.split('/')[0]
        if (!specifier.startsWith('#') && !declared.has(name)) {
          errors.push(`${path}: undeclared runtime import ${specifier}`)
          continue
        }
        resolutions.push({
          specifier,
          parent: pathToFileURL(path).href,
          optional: !!(
            pkg.peerDependenciesMeta?.[name]?.optional || pkg.optionalDependencies?.[name]
          ),
        })
      }
    }
  }
  // Resolve with ESM conditions, not require.resolve: import-only peers (Inertia)
  // intentionally have no CommonJS export. Batch in one process per package.
  const resolution = spawnSync(
    process.execPath,
    [
      '--experimental-import-meta-resolve',
      '--input-type=module',
      '-e',
      `import { statSync } from 'node:fs';
     const errors = [];
     for (const item of ${JSON.stringify(resolutions)}) {
       try {
         const target = import.meta.resolve(item.specifier, item.parent);
         if (target.startsWith('file:')) statSync(new URL(target));
       } catch (error) {
         if (!(item.optional && error.code === 'ERR_MODULE_NOT_FOUND')) errors.push(item.parent + ': runtime import ' + item.specifier + ' does not resolve (' + error.code + ')');
       }
     }
     console.log(JSON.stringify(errors));`,
    ],
    { encoding: 'utf8' }
  )
  if (resolution.status !== 0) errors.push(`Dependency resolver failed: ${resolution.stderr}`)
  else errors.push(...JSON.parse(resolution.stdout))
  if (!files) errors.push(`${pkg.name}: no built runtime files found`)
  return { files, errors }
}
