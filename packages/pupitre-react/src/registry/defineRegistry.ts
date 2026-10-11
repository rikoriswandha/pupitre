/* eslint-disable @unicorn/filename-case */
import { defineCatalog, defineDirective } from '@json-render/core'
import { z } from 'zod'
import type { ComputedFunction, DirectiveDefinition } from '@json-render/core'
import type { DefineRegistryResult } from '@json-render/react'
import { defineRegistry as jsonDefineRegistry } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { pupitreCatalog } from '@rikology/pupitre/catalog'
import type { ShellRegistry } from '../shell/types.js'
import { builtInFunctions } from '../renderer/functions.js'
import { visit, reload, runAction } from '../bridge/actions.js'

const catalog = defineCatalog(schema, pupitreCatalog)
export type PupitreFunctions = typeof builtInFunctions
export type RegistryComponents = NonNullable<
  Parameters<typeof jsonDefineRegistry<typeof catalog>>[1]['components']
>
export type PupitreRegistry = {
  registry: DefineRegistryResult['registry']
  shell: ShellRegistry
  functions: PupitreFunctions & Record<string, ComputedFunction>
  directives: DirectiveDefinition[]
}
export type HostRegistryComponents = RegistryComponents & ShellRegistry
const rawDirective = defineDirective({
  name: '$raw',
  description: 'Passes a nested spec through without resolving expressions in its contents.',
  schema: z.object({ $raw: z.unknown() }),
  resolve: (value) => value.$raw,
})
const registryHandlers = new WeakMap<object, DefineRegistryResult['handlers']>()
export function getRegistryHandlers(registry: PupitreRegistry['registry']) {
  const handlers = registryHandlers.get(registry)
  if (!handlers) throw new Error('Registry handlers are unavailable for this Pupitre registry.')
  return handlers
}
const unavailable = (name: string) => async () => {
  throw new Error(`Pupitre ${name} action requires the page runtime.`)
}
const actions = {
  visit: async (params?: {
    url: string
    method?: 'get' | 'post' | 'put' | 'patch' | 'delete'
    data?: Record<string, unknown>
    preserveScroll?: boolean
  }) => visit(params ?? {}),
  reload: async (params?: { only: string[]; data?: Record<string, unknown> }) =>
    reload(params ?? {}),
  submitForm: unavailable('submitForm'),
  openAction: unavailable('openAction'),
  runAction: async (params?: {
    url: string
    method: 'get' | 'post' | 'put' | 'patch' | 'delete'
    ids?: Array<string | number>
  }) => runAction(params ?? { url: '', method: 'post' }),
  evaluate: unavailable('evaluate'),
  upload: unavailable('upload'),
  toast: unavailable('toast'),
  copy: async (params?: { text: string }) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard)
      await navigator.clipboard.writeText(params?.text ?? '')
  },
}
export function defineRegistry<TComponents extends HostRegistryComponents>(
  components: TComponents,
  options: {
    functions?: Partial<PupitreFunctions> & Record<string, ComputedFunction>
  } = {}
) {
  const catalogComponents = Object.fromEntries(
    Object.entries(components).filter(([name]) => name in pupitreCatalog.components)
  ) as RegistryComponents
  const result = jsonDefineRegistry(catalog, { components: catalogComponents, actions })
  const shell = Object.fromEntries(
    Object.entries(components).filter(([name]) => !(name in pupitreCatalog.components))
  ) as ShellRegistry
  const functions = { ...builtInFunctions, ...options.functions }
  registryHandlers.set(result.registry, result.handlers)
  return { registry: result.registry, shell, functions, directives: [rawDirective] }
}
