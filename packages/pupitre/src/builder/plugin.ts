import type { PupitrePlugin } from '../definition/plugin.js'

const PLUGIN_KEYS: Record<string, true> = {
  name: true,
  register: true,
  resources: true,
  pages: true,
  widgets: true,
  middleware: true,
  navigation: true,
  extendResource: true,
  boot: true,
}

const HOOKS = ['register', 'extendResource', 'boot'] as const

/**
 * Declares a Pupitre plugin. Validates the shape eagerly so typos surface at
 * import time instead of being silently ignored at boot.
 */
export function definePlugin<Plugin extends PupitrePlugin>(plugin: Plugin): Plugin {
  if (!plugin || typeof plugin !== 'object') throw new Error('Pupitre plugin must be an object')
  if (typeof plugin.name !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(plugin.name))
    throw new Error(`Invalid Pupitre plugin name "${String(plugin.name)}"; use kebab-case`)
  for (const key of Object.keys(plugin)) {
    if (!PLUGIN_KEYS[key])
      throw new Error(`Unknown key "${key}" in Pupitre plugin "${plugin.name}"`)
  }
  for (const hook of HOOKS) {
    if (plugin[hook] !== undefined && typeof plugin[hook] !== 'function')
      throw new Error(`Pupitre plugin "${plugin.name}" hook "${hook}" must be a function`)
  }
  if (plugin.middleware !== undefined && !Array.isArray(plugin.middleware))
    throw new Error(`Pupitre plugin "${plugin.name}" middleware must be an array`)
  if (plugin.navigation !== undefined && !Array.isArray(plugin.navigation))
    throw new Error(`Pupitre plugin "${plugin.name}" navigation must be an array`)
  return plugin
}
