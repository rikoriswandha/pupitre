import { readFile, readdir } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../', import.meta.url))
export const packages = [
  'pupitre',
  'pupitre-react',
  'pupitre-ui',
  'pupitre-shield',
  'pupitre-audit',
  'pupitre-settings',
  'pupitre-transmit',
]

// Use the existing TypeScript parser so TS annotations and JSX cannot hide calls.
export function extractKeys(source, filename = 'source.ts') {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true)
  const names = new Set(['t'])
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const binding of bindings.elements) {
      if ((binding.propertyName ?? binding.name).text === 't') names.add(binding.name.text)
    }
  }
  const keys = []
  const errors = []
  for (const diagnostic of file.parseDiagnostics) {
    errors.push(`${filename}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`)
  }
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      names.has(node.expression.text)
    ) {
      const position = file.getLineAndCharacterOfPosition(node.getStart(file))
      const location = `${filename}:${position.line + 1}:${position.character + 1}`
      const key = node.arguments[0]
      if (!key || !ts.isStringLiteral(key)) {
        errors.push(`${location}: t() requires an English string literal key`)
      } else {
        keys.push({ key: key.text, location })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return { keys, errors }
}

export function checkKeys(extracted, dictionary) {
  const errors = [...extracted.errors]
  for (const { key, location } of extracted.keys) {
    if (!Object.hasOwn(dictionary, key)) {
      errors.push(`${location}: missing Indonesian translation for ${JSON.stringify(key)}`)
      continue
    }
    const message = dictionary[key]
    const valid = typeof message === 'string' && message.length > 0
    const plural =
      message &&
      typeof message === 'object' &&
      typeof message.one === 'string' &&
      message.one.length > 0 &&
      typeof message.other === 'string' &&
      message.other.length > 0 &&
      (message.zero === undefined || (typeof message.zero === 'string' && message.zero.length > 0))
    if (!valid && !plural)
      errors.push(`${location}: invalid Indonesian translation for ${JSON.stringify(key)}`)
  }
  return errors
}

async function sourceFiles(directory) {
  const files = []
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return files
    throw error
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (
      [
        'tests',
        'test',
        'build',
        'dist',
        'node_modules',
        'stubs',
        'coverage',
        'test-results',
        'playwright',
        '.adonisjs',
      ].includes(entry.name)
    )
      continue
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)))
    else if (/\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts'))
      files.push(path)
  }
  return files.sort()
}

export async function check(repository = root) {
  const { default: dictionary } = await import(
    pathToFileURL(resolve(repository, 'packages/pupitre/src/locales/id.ts')).href
  )
  if (!dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary)) {
    throw new Error('Indonesian catalog must export a default message dictionary')
  }
  const extracted = { keys: [], errors: [] }
  const { default: clientKeys } = await import(
    pathToFileURL(resolve(repository, 'packages/pupitre/src/locales/client_keys.ts')).href
  )
  const clientKeySet = new Set(clientKeys)
  for (const name of packages) {
    for (const file of await sourceFiles(resolve(repository, 'packages', name))) {
      const result = extractKeys(await readFile(file, 'utf8'), relative(repository, file))
      extracted.keys.push(...result.keys)
      extracted.errors.push(...result.errors)
      if (name === 'pupitre-react' || name === 'pupitre-ui') {
        for (const { key, location } of result.keys)
          if (!clientKeySet.has(key))
            extracted.errors.push(
              `${location}: missing client dictionary key ${JSON.stringify(key)}`
            )
      }
    }
  }
  return {
    errors: checkKeys(extracted, dictionary),
    keyCount: new Set(extracted.keys.map(({ key }) => key)).size,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await check()
    if (result.errors.length) {
      console.error(result.errors.join('\n'))
      process.exitCode = 1
    } else {
      console.info(`Indonesian catalog covers ${result.keyCount} literal translation keys.`)
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
