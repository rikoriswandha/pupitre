/* eslint-disable @unicorn/filename-case */
import { defineCatalog, defineDirective } from '@json-render/core'
import { z } from 'zod'
import type { ComputedFunction, DirectiveDefinition } from '@json-render/core'
import type { DefineRegistryResult } from '@json-render/react'
import type { BaseComponentProps, Components } from '@json-render/react'
import type { ReactNode } from 'react'
import { defineRegistry as jsonDefineRegistry } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { pupitreCatalog } from '@rikology/pupitre/catalog'
import { mergeCatalogExtensions } from '@rikology/pupitre/catalog'
import type {
  CatalogExtension,
  CatalogExtensionComponent,
  ColumnDescriptor,
  TableRow,
} from '@rikology/pupitre/catalog'
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
type ExtensionProps<C extends CatalogExtensionComponent> = z.output<C['props']> & {
  value: unknown
  label?: string | null
} & (C['kind'] extends 'field'
    ? {
        name: string
        error?: string | null
        disabled?: boolean
        readOnly?: boolean
        required?: boolean
        helperText?: string | null
        hint?: string | null
        placeholder?: string | null
        columnSpan?: number | 'full'
      }
    : C['kind'] extends 'column'
      ? {
          descriptor: ColumnDescriptor
          row: TableRow
        }
      : {
          record?: unknown
        })
type ExtensionComponents<E> = E extends CatalogExtension
  ? {
      [K in keyof E['components']]: (
        context: BaseComponentProps<ExtensionProps<E['components'][K]>>
      ) => ReactNode
    }
  : never
type Intersect<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I
) => void
  ? I
  : never
export type ExtensionRegistryComponents<E extends readonly CatalogExtension[]> =
  E extends readonly [] ? object : Intersect<ExtensionComponents<E[number]>>
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
export function defineRegistry<
  const TExtensions extends readonly CatalogExtension[] = readonly [],
  TComponents extends HostRegistryComponents & ExtensionRegistryComponents<TExtensions> =
    HostRegistryComponents & ExtensionRegistryComponents<TExtensions>,
>(
  components: TComponents,
  options: {
    extensions?: TExtensions
    functions?: Partial<PupitreFunctions> & Record<string, ComputedFunction>
  } = {}
) {
  const merged = mergeCatalogExtensions(options.extensions)
  for (const extension of options.extensions ?? []) {
    for (const name of Object.keys(extension.components)) {
      if (
        !Object.hasOwn(components, name) ||
        typeof components[name as keyof TComponents] !== 'function'
      )
        throw new Error(
          `Pupitre extension "${extension.name}" requires component "${name}" in defineRegistry().`
        )
    }
  }
  const mergedCatalog = defineCatalog(schema, merged)
  const catalogComponents = Object.fromEntries(
    Object.entries(components).filter(([name]) => Object.hasOwn(merged.components, name))
  ) as Components<typeof mergedCatalog>
  const result = jsonDefineRegistry(mergedCatalog, {
    components: catalogComponents,
    actions,
  })
  const shell = Object.fromEntries(
    Object.entries(components).filter(([name]) => !Object.hasOwn(merged.components, name))
  ) as ShellRegistry
  const functions = { ...builtInFunctions, ...options.functions }
  registryHandlers.set(result.registry, result.handlers)
  return { registry: result.registry, shell, functions, directives: [rawDirective] }
}
