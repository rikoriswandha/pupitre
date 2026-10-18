import { readFile, mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repository = new URL('../../../', import.meta.url)
const content = new URL('../src/content/docs/', import.meta.url)
const printer = ts.createPrinter()
const references = [
  ['panel', 'Panels and navigation', ['src/builder/panel.ts', 'src/builder/nav.ts', 'src/definition/panel.ts', 'src/definition/navigation.ts']],
  ['resource', 'Resources and relations', ['src/builder/resource.ts', 'src/builder/relation_manager.ts', 'src/definition/resource.ts', 'src/definition/relation_manager.ts', 'src/definition/page.ts']],
  ['schema', 'Forms and infolists', ['src/definition/schema.ts']],
  ['table', 'Tables', ['src/definition/table.ts']],
  ['action', 'Actions and notifications', ['src/definition/action.ts']],
  ['page-widget', 'Pages and widgets', ['src/builder/page.ts', 'src/builder/widget.ts', 'src/definition/custom_page.ts', 'src/definition/widget.ts']],
  ['configuration', 'Configuration, tenancy and themes', ['src/define_config.ts', 'src/definition/tenancy.ts', 'src/definition/theme.ts', 'src/adapters/mail.ts', 'src/adapters/jobs.ts', 'src/adapters/notifications.ts', 'src/adapters/realtime.ts', 'src/adapters/audit.ts']],
  ['plugin', 'Plugins', ['src/definition/plugin.ts', 'src/builder/plugin.ts']],
]

// Resolve the published entry points, not every `export` inside implementation files.
// The TypeScript checker follows named, star and type-only re-exports and aliases.
const packageRoot = fileURLToPath(new URL('packages/pupitre/', repository))
const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'))
const entries = []
for (const target of Object.values(manifest.exports)) {
  const published = typeof target === 'string' ? target : target['@rikology/source'] ?? target.types ?? target.default
  if (!published) throw new Error('Public API entry has no source or compiled target')
  const sourceTarget = published.replace(/^\.\/build\//, './').replace(/\.d\.ts$|\.js$/, '.ts')
  if (sourceTarget.includes('*')) {
    const pattern = resolve(packageRoot, sourceTarget)
    entries.push(...ts.sys.readDirectory(dirname(pattern), ['.ts'], undefined, [pattern]))
  } else {
    entries.push(resolve(packageRoot, sourceTarget))
  }
}
const program = ts.createProgram([...new Set(entries)], {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  customConditions: ['@rikology/source'],
  skipLibCheck: true,
  noEmit: true,
})
const checker = program.getTypeChecker()
const publicDeclarations = new Set()
const publicNames = new Set()
for (const entry of entries) {
  const source = program.getSourceFile(entry)
  const module = source && checker.getSymbolAtLocation(source)
  if (!module) throw new Error(`Cannot resolve public API entry ${entry}`)
  for (const exported of checker.getExportsOfModule(module)) {
    const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
    for (const declaration of symbol.declarations ?? []) {
      // Only print a declaration under its actual public name, not an internal alias.
      if (declaration.name && ts.isIdentifier(declaration.name) && declaration.name.text === exported.name) {
        publicDeclarations.add(declaration)
        publicNames.add(exported.name)
      }
    }
  }
}

function assertPublicReference(text, path) {
  for (const [, block] of text.matchAll(/```ts\n([\s\S]*?)```/g)) {
    const source = ts.createSourceFile(path, block, ts.ScriptTarget.Latest, true)
    for (const declaration of source.statements) {
      const names = []
      const collect = (name) => {
        if (ts.isIdentifier(name)) names.push(name.text)
        else for (const element of name.elements) {
          if (ts.isBindingElement(element)) collect(element.name)
        }
      }
      if (ts.isVariableStatement(declaration)) {
        for (const variable of declaration.declarationList.declarations) collect(variable.name)
      } else if (declaration.name && ts.isIdentifier(declaration.name)) {
        collect(declaration.name)
      }
      for (const name of names) {
        if (!publicNames.has(name)) {
          throw new Error(`Docs API reference ${path} documents non-exported symbol ${name}`)
        }
      }
    }
  }
}

await mkdir(new URL('reference/', content), { recursive: true })
for (const [index, [slug, title, files]] of references.entries()) {
  const sections = []
  for (const relative of files) {
    const path = `packages/pupitre/${relative}`
    const source = program.getSourceFile(resolve(packageRoot, relative))
    if (!source) throw new Error(`Cannot resolve reference source ${path}`)
    const declarations = source.statements.flatMap((statement) => {
      if (!publicDeclarations.has(statement)) return []
      if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
        return [printer.printNode(ts.EmitHint.Unspecified, statement, source)]
      }
      if (ts.isFunctionDeclaration(statement)) {
        const signature = ts.factory.updateFunctionDeclaration(statement, statement.modifiers, statement.asteriskToken, statement.name, statement.typeParameters, statement.parameters, statement.type, undefined)
        return [printer.printNode(ts.EmitHint.Unspecified, signature, source)]
      }
      return []
    })
    if (declarations.length) sections.push(`## ${relative}\n\n[Source](https://github.com/rikoriswandha/pupitre/blob/main/${path})\n\n\`\`\`ts\n${declarations.join('\n\n')}\n\`\`\`\n`)
  }
  const frontmatter = `---\ntitle: "API: ${title}"\ndescription: Public TypeScript declarations for ${title.toLowerCase()} exported by @rikology/pupitre.\nsidebar:\n  order: ${index + 1}\n---`
  const page = `${frontmatter}\n\nThis reference is generated before development, checking and building from declarations reachable through the package's published entry points, following re-exports. Internal source-module exports are omitted. Types shown together share their source module; follow the source link for imports and implementation. Use the guides for examples and runtime behavior.\n\n${sections.join('\n')}`
  assertPublicReference(page, `reference/api-${slug}.md`)
  await writeFile(new URL(`reference/api-${slug}.md`, content), page)
}

// Also reject any additional API reference page that advertises an internal symbol.
// This runs in precheck/prebuild, so unexported declarations cannot reach the site.
for (const file of await readdir(new URL('reference/', content))) {
  if (!/^api-.*\.md$/.test(file)) continue
  assertPublicReference(await readFile(new URL(`reference/${file}`, content), 'utf8'), file)
}

const packages = (await readdir(new URL('packages/', repository))).sort()
const changelogs = []
for (const name of packages) {
  try {
    const text = await readFile(new URL(`packages/${name}/CHANGELOG.md`, repository), 'utf8')
    changelogs.push(`## ${name}\n\n[Package source](https://github.com/rikoriswandha/pupitre/blob/main/packages/${name}/CHANGELOG.md)\n\n${text.replace(/^# /gm, '### ').replace(/^## /gm, '### ')}\n`)
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
  }
}
await writeFile(new URL('changelog.md', content), `---\ntitle: Changelog\ndescription: Release notes aggregated directly from the package changelogs.\n---\n\nThese notes are imported from each package's CHANGELOG.md at build time. Unreleased entries describe work on the current source branch, not a published npm release.\n\n${changelogs.join('\n')}`)
