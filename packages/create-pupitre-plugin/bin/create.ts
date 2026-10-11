#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { createPlugin, pluginNames } from '../index.js'

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: 'string' },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) {
    console.log('Usage: create-pupitre-plugin <name> [--dir <path>] [--force]')
  } else {
    if (positionals.length !== 1)
      throw new Error('Usage: create-pupitre-plugin <name> [--dir <path>] [--force]')
    const name = positionals[0]!
    const names = pluginNames(name)
    const directory = values.dir ?? `pupitre-${names.name}`
    const written = await createPlugin({ name, directory, force: values.force })
    console.log(`Created ${names.packageName} in ${resolve(directory)}:`)
    for (const path of written) console.log(`  ${path}`)
    console.log(`Next: cd ${JSON.stringify(directory)} && npm install && npm test`)
    console.log(`Add ${names.camelName}() to your panel's .plugins([...]).`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
