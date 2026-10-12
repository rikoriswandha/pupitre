import type { z } from 'zod'
import type { SchemaTypes } from '@vinejs/vine/types'
import type { CatalogExtension, CatalogExtensionComponent } from '../../catalog/extensions.js'
import { defineCatalogExtension } from '../../catalog/extensions.js'
import { createNode, schema } from './schema/schema.js'
import type { FieldCommon, SchemaNodeDefinition } from '../definition/schema.js'
import type {
  ExtensionMethods,
  ExtensionFieldBuilder,
  ExtensionColumnBuilder,
  ExtensionEntryBuilder,
  ExtensionMetadata,
} from '../definition/extensions.js'

type ComponentProps<C extends CatalogExtension, N extends keyof C['components']> = z.infer<
  C['components'][N]['props']
>
type Options<
  C extends CatalogExtension,
  N extends keyof C['components'],
  M extends ExtensionMethods,
> = {
  extension: C
  component: N
  methods?: M
}
type Registration = {
  extension: CatalogExtension
  component: string
  validate?: (props: Record<string, unknown>) => SchemaTypes
}
const registrations = new Map<string, Registration>()
const registeredComponents = new Map<string, string>()
export function isRegisteredExtensionComponent(name: string): boolean {
  return registeredComponents.has(name)
}

/** Collect only extension components emitted in specs and table descriptors. */
export function collectCatalogExtensions(value: unknown) {
  const required = new Map<string, Set<string>>()
  const visited = new WeakSet<object>()
  const walk = (current: unknown): void => {
    if (!current || typeof current !== 'object' || visited.has(current)) return
    visited.add(current)
    const object = current as Record<string, unknown>
    const component =
      typeof object.component === 'string'
        ? object.component
        : typeof object.type === 'string' && object.props
          ? object.type
          : undefined
    const extension = component && registeredComponents.get(component)
    if (extension && component) {
      const components = required.get(extension) ?? new Set<string>()
      components.add(component)
      required.set(extension, components)
    }
    if (Array.isArray(object.catalogExtensions)) {
      for (const requirement of object.catalogExtensions) {
        if (!Array.isArray(requirement?.components)) continue
        for (const name of requirement.components) {
          const owner = typeof name === 'string' && registeredComponents.get(name)
          if (!owner) continue
          const components = required.get(owner) ?? new Set<string>()
          components.add(name)
          required.set(owner, components)
        }
      }
    }
    for (const child of Object.values(object)) walk(child)
  }
  walk(value)
  return [...required].map(([name, components]) => ({ name, components: [...components] }))
}
const columnKinds: Record<string, true> = {
  text: true,
  badge: true,
  icon: true,
  image: true,
  color: true,
  custom: true,
  fragment: true,
  toggle: true,
  checkbox: true,
  select: true,
  textInput: true,
}

function assertMethods(
  methods: ExtensionMethods | undefined,
  category: CatalogExtensionComponent['kind']
) {
  const base =
    category === 'column'
      ? undefined
      : createNode({
          kind: category === 'field' ? 'extensionField' : 'extensionEntry',
          name: '',
        } as SchemaNodeDefinition)
  for (const name of Object.keys(methods ?? {})) {
    if (
      name === 'toDefinition' ||
      (base && typeof Reflect.get(base, name) === 'function') ||
      (category === 'column' &&
        ['label', 'sortable', 'searchable', 'toggleable', 'alignment', 'width'].includes(name))
    )
      throw new Error(`Pupitre extension method "${name}" collides with a base ${category} method`)
  }
}
function register(
  kind: string,
  category: CatalogExtensionComponent['kind'],
  extension: CatalogExtension,
  component: string,
  validate?: Registration['validate']
) {
  defineCatalogExtension(extension)
  if (
    !kind ||
    Object.hasOwn(schema, kind) ||
    Object.hasOwn(columnKinds, kind) ||
    kind === 'extensionField' ||
    kind === 'extensionEntry'
  )
    throw new Error(`Pupitre extension kind "${kind}" collides with a built-in kind`)
  const definition = extension.components[component]
  if (!definition || definition.kind !== category)
    throw new Error(
      `Pupitre extension "${extension.name}" component "${component}" is not a ${category}`
    )
  const key = `${extension.name}:${category}:${kind}`
  if (registrations.has(key))
    throw new Error(`Duplicate Pupitre extension ${category} kind "${kind}"`)
  registrations.set(key, { extension, component, validate })
  registeredComponents.set(component, extension.name)
}

export function validateExtensionProps(node: ExtensionMetadata) {
  const category =
    'kind' in node && node.kind === 'extensionField'
      ? 'field'
      : 'kind' in node && node.kind === 'extensionEntry'
        ? 'entry'
        : 'column'
  const registration = registrations.get(`${node.extension}:${category}:${node.extensionKind}`)
  if (
    !registration ||
    registration.extension.name !== node.extension ||
    registration.component !== node.component
  )
    throw new Error(
      `Unregistered Pupitre extension ${category} "${node.extensionKind}" (${node.extension}/${node.component})`
    )
  const result = registration.extension.components[node.component].props.safeParse(
    node.extensionProps
  )
  if (!result.success)
    throw new Error(
      `Invalid props for Pupitre extension "${node.extension}" component "${node.component}": ${result.error.message}`
    )
  return result.data as Record<string, unknown>
}
const frameworkProps: Record<string, true> = {
  name: true,
  value: true,
  error: true,
  label: true,
  required: true,
  disabled: true,
  readOnly: true,
  helperText: true,
  hint: true,
  placeholder: true,
  columnSpan: true,
  extraAttributes: true,
  record: true,
}
/** Framework-owned bindings and base builder options always win over custom defaults. */
export function extensionRenderProps(node: ExtensionMetadata) {
  const props = validateExtensionProps(node)
  for (const key of Object.keys(props)) if (Object.hasOwn(frameworkProps, key)) delete props[key]
  return props
}
export function extensionValueSchema(node: ExtensionMetadata): SchemaTypes {
  const registration = registrations.get(`${node.extension}:field:${node.extensionKind}`)
  if (!registration?.validate)
    throw new Error(`Pupitre extension field "${node.extensionKind}" has no validator`)
  return registration.validate(validateExtensionProps(node))
}

function builder(
  definition: SchemaNodeDefinition | (ExtensionMetadata & Record<string, unknown>),
  methods: ExtensionMethods,
  category: CatalogExtensionComponent['kind']
): object {
  const base = category === 'column' ? undefined : createNode(definition as SchemaNodeDefinition)
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'definition' && category === 'column') return definition
        if (property === 'toDefinition')
          return () => {
            const node = definition as SchemaNodeDefinition & ExtensionMetadata
            // Keep schema input in definitions: compilers consume the parsed output,
            // and transforming schemas must never receive their own output as input.
            validateExtensionProps(node)
            return { ...node, extensionProps: { ...node.extensionProps } }
          }
        if (typeof property !== 'string') return undefined
        if (Object.hasOwn(methods, property))
          return (...args: never[]) => {
            const patch = methods[property](...args)
            const extensionProps = { ...(definition as ExtensionMetadata).extensionProps, ...patch }
            const registrationSchema = registrations.get(
              `${(definition as ExtensionMetadata).extension}:${category}:${(definition as ExtensionMetadata).extensionKind}`
            )!.extension.components[(definition as ExtensionMetadata).component].props
            for (const key of Object.keys(patch))
              if (!Object.hasOwn(registrationSchema.shape, key))
                throw new Error(
                  `Unknown prop "${key}" for Pupitre extension component "${(definition as ExtensionMetadata).component}"`
                )
            const node = { ...definition, extensionProps } as SchemaNodeDefinition &
              ExtensionMetadata
            // Validate supplied properties individually; full object refinements run
            // at toDefinition/compile after required props have all been supplied.
            for (const [key, value] of Object.entries(patch)) {
              const result = registrationSchema.shape[key].safeParse(value)
              if (!result.success)
                throw new Error(
                  `Invalid props for Pupitre extension component "${node.component}": ${result.error.message}`
                )
            }
            return builder(node, methods, category)
          }
        if (base) {
          const method = Reflect.get(base, property)
          if (typeof method !== 'function') return undefined
          return (...args: unknown[]) => builder(method(...args).toDefinition(), methods, category)
        }
        if (
          !['label', 'sortable', 'searchable', 'toggleable', 'alignment', 'width'].includes(
            property
          )
        )
          return undefined
        return (value?: unknown) => {
          if (property === 'searchable' && value && typeof value === 'object')
            return builder(
              {
                ...definition,
                searchable: true,
                individuallySearchable: 'individually' in value && value.individually === true,
              },
              methods,
              category
            )
          return builder(
            {
              ...definition,
              [property]:
                value ??
                (property === 'toggleable'
                  ? {}
                  : ['searchable', 'sortable'].includes(property)
                    ? true
                    : value),
            },
            methods,
            category
          )
        }
      },
    }
  )
}

export function defineField<
  const C extends CatalogExtension,
  const N extends keyof C['components'] & string,
  M extends ExtensionMethods = Record<never, never>,
>(
  kind: string,
  options: Options<C, N, M> & {
    validate(props: ComponentProps<C, N>): SchemaTypes
    dehydrate?: FieldCommon['dehydrate']
    format?: FieldCommon['format']
  }
): (name: string) => ExtensionFieldBuilder<M> {
  assertMethods(options.methods, 'field')
  register(
    kind,
    'field',
    options.extension,
    options.component,
    options.validate as Registration['validate']
  )
  return (name) =>
    builder(
      {
        kind: 'extensionField',
        name,
        extension: options.extension.name,
        extensionKind: kind,
        component: options.component,
        extensionProps: {},
        dehydrate: options.dehydrate,
        format: options.format,
      },
      options.methods ?? {},
      'field'
    ) as ExtensionFieldBuilder<M>
}
export function defineColumn<
  const C extends CatalogExtension,
  const N extends keyof C['components'] & string,
  M extends ExtensionMethods = Record<never, never>,
>(
  kind: string,
  options: Options<C, N, M> & {
    format?: (value: unknown, record: Record<string, unknown>) => unknown
  }
): (name: string) => ExtensionColumnBuilder<M> {
  assertMethods(options.methods, 'column')
  register(kind, 'column', options.extension, options.component)
  return (name) =>
    builder(
      {
        kind: 'custom',
        name,
        extension: options.extension.name,
        extensionKind: kind,
        component: options.component,
        extensionProps: {},
        format: options.format,
      },
      options.methods ?? {},
      'column'
    ) as ExtensionColumnBuilder<M>
}
export function defineEntry<
  const C extends CatalogExtension,
  const N extends keyof C['components'] & string,
  M extends ExtensionMethods = Record<never, never>,
>(
  kind: string,
  options: Options<C, N, M> & {
    format?: (value: unknown, record: Record<string, unknown>) => unknown
  }
): (name: string) => ExtensionEntryBuilder<M> {
  assertMethods(options.methods, 'entry')
  register(kind, 'entry', options.extension, options.component)
  return (name) =>
    builder(
      {
        kind: 'extensionEntry',
        name,
        extension: options.extension.name,
        extensionKind: kind,
        component: options.component,
        extensionProps: {},
        format: options.format,
      },
      options.methods ?? {},
      'entry'
    ) as ExtensionEntryBuilder<M>
}
