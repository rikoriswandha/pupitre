import type {
  SchemaNamespace,
  BlockSchemaNamespace,
  SchemaNodeDefinition,
  SchemaNodeBuilder,
  SchemaKind,
  ComponentDefinition,
  FieldDefinitionUnion,
  FormSchema,
  LayoutDefinition,
  RelationshipOptions,
  RepeaterRelationshipOptions,
  BuilderBlockBuilder,
  BuilderBlockDefinition,
} from '../../definition/schema.js'
type AnyBuilder = SchemaNodeBuilder
const fieldBase = [
  'label',
  'helperText',
  'hint',
  'hintIcon',
  'hintColor',
  'hintAction',
  'placeholder',
  'default',
  'required',
  'nullable',
  'disabled',
  'readOnly',
  'visible',
  'hidden',
  'columnSpan',
  'extraAttributes',
  'live',
  'afterStateUpdated',
  'dehydrated',
  'dehydratedWhenHidden',
  'format',
  'dehydrate',
  'rules',
]
const textMethods = [
  'prefix',
  'suffix',
  'autocomplete',
  'datalist',
  'mask',
  'tel',
  'telRegex',
  'prefixAction',
  'suffixAction',
  'minLength',
  'maxLength',
  'regex',
  'alpha',
  'alphaNumeric',
  'email',
  'url',
  'in',
  'same',
  'different',
  'confirmed',
  'unique',
  'exists',
]
const methodMap: Record<SchemaKind, readonly string[]> = {
  slider: [...fieldBase, 'min', 'max', 'step', 'marks', 'range'],
  text: [...fieldBase, ...textMethods],
  email: [...fieldBase, ...textMethods],
  password: [...fieldBase, ...textMethods, 'revealable'],
  number: [...fieldBase, 'min', 'max', 'step', 'prefix', 'suffix', 'unique'],
  textarea: [...fieldBase, 'rows', 'autosize', 'minLength', 'maxLength'],
  hidden: fieldBase,
  select: [
    ...fieldBase,
    'options',
    'native',
    'clearable',
    'multiple',
    'in',
    'exists',
    'relationship',
    'searchable',
    'preload',
    'getOptionLabelUsing',
    'createOptionForm',
    'createOptionUsing',
    'prefixAction',
    'suffixAction',
  ],
  multiSelect: [
    ...fieldBase,
    'options',
    'native',
    'clearable',
    'in',
    'exists',
    'relationship',
    'searchable',
    'preload',
    'getOptionLabelUsing',
    'createOptionForm',
    'createOptionUsing',
    'prefixAction',
    'suffixAction',
  ],
  checkbox: [...fieldBase, 'inline'],
  checkboxList: [...fieldBase, 'options', 'columns'],
  radio: [...fieldBase, 'options', 'descriptions', 'inline'],
  toggle: [...fieldBase, 'onIcon', 'offIcon', 'onColor', 'offColor', 'inline'],
  toggleButtons: [...fieldBase, 'options', 'multiple', 'grouped', 'icons', 'colors'],
  date: [...fieldBase, 'minDate', 'maxDate', 'timezone', 'seconds'],
  dateTime: [...fieldBase, 'minDate', 'maxDate', 'timezone', 'seconds'],
  time: [...fieldBase, 'minDate', 'maxDate', 'timezone', 'seconds'],
  color: [...fieldBase.filter((method) => method !== 'format'), 'presets'],
  tags: [...fieldBase, 'suggestions', 'separator', 'maxTags', 'reorderable'],
  keyValue: [
    ...fieldBase,
    'keyLabel',
    'valueLabel',
    'addable',
    'deletable',
    'reorderable',
    'keyPlaceholder',
    'valuePlaceholder',
  ],
  markdownEditor: [
    ...fieldBase,
    'toolbar',
    'fileAttachmentsDisk',
    'fileAttachmentsDirectory',
    'fileAttachments',
    'preview',
  ],
  codeEditor: [...fieldBase, 'language', 'lineNumbers', 'minHeight'],
  richEditor: [
    ...fieldBase,
    'toolbar',
    'minHeight',
    'maxHeight',
    'fileAttachmentsDisk',
    'fileAttachmentsDirectory',
  ],
  fileUpload: [
    ...fieldBase,
    'disk',
    'image',
    'maxSize',
    'multiple',
    'maxFiles',
    'accept',
    'directory',
    'visibility',
    'reorderable',
    'downloadable',
    'previewable',
    'imageEditor',
    'imageEditorAspectRatios',
  ],
  builder: [
    ...fieldBase,
    'blocks',
    'minItems',
    'maxItems',
    'reorderable',
    'collapsible',
    'cloneable',
    'addLabel',
    'blockPickerColumns',
  ],
  repeater: [
    ...fieldBase,
    'schema',
    'minItems',
    'maxItems',
    'reorderable',
    'collapsible',
    'collapsed',
    'cloneable',
    'addLabel',
    'itemLabel',
    'defaultItems',
    'grid',
    'relationship',
  ],
  wizard: [
    'visible',
    'hidden',
    'columnSpan',
    'extraAttributes',
    'steps',
    'skippable',
    'startOnStep',
    'submitLabel',
  ],
  step: ['components', 'schema', 'description', 'icon'],
  grid: ['visible', 'hidden', 'columnSpan', 'extraAttributes', 'components', 'columns', 'gap'],
  section: [
    'visible',
    'hidden',
    'columnSpan',
    'extraAttributes',
    'components',
    'heading',
    'description',
    'icon',
    'collapsible',
    'collapsed',
    'aside',
    'compact',
    'columns',
  ],
  fieldset: [
    'visible',
    'hidden',
    'columnSpan',
    'extraAttributes',
    'components',
    'label',
    'columns',
  ],
  tabs: ['visible', 'hidden', 'columnSpan', 'extraAttributes', 'components'],
  tab: ['visible', 'hidden', 'columnSpan', 'extraAttributes', 'components'],
  group: ['visible', 'hidden', 'columnSpan', 'extraAttributes', 'components'],
  split: ['visible', 'hidden', 'columnSpan', 'extraAttributes', 'components', 'columns'],
  placeholder: ['visible', 'hidden', 'columnSpan', 'extraAttributes', 'content', 'label'],
  html: ['visible', 'hidden', 'columnSpan', 'extraAttributes', 'content'],
  divider: ['visible', 'hidden', 'columnSpan', 'extraAttributes'],
  view: ['visible', 'hidden', 'columnSpan', 'extraAttributes', 'props'],
  fragment: ['visible', 'hidden', 'columnSpan', 'extraAttributes', 'components'],
  textEntry: [
    'label',
    'copyable',
    'url',
    'badge',
    'dateTime',
    'timezone',
    'date',
    'since',
    'money',
    'limit',
    'markdown',
  ],
  iconEntry: ['label', 'boolean', 'icons', 'colors'],
  imageEntry: ['label', 'circular'],
  colorEntry: ['label'],
  keyValueEntry: ['label'],
  repeatableEntry: ['label', 'schema'],
  codeEntry: ['label', 'language'],
  badgeEntry: ['label', 'colors'],
}
const validatorMethods: Record<string, true> = Object.fromEntries(
  [
    'required',
    'nullable',
    'minLength',
    'maxLength',
    'min',
    'max',
    'step',
    'email',
    'url',
    'regex',
    'alpha',
    'alphaNumeric',
    'in',
    'same',
    'different',
    'confirmed',
    'unique',
    'exists',
    'rules',
  ].map((name) => [name, true])
)
const booleanDefaultMethods: Record<string, true> = Object.fromEntries(
  [
    'required',
    'nullable',
    'readOnly',
    'dehydrated',
    'dehydratedWhenHidden',
    'searchable',
    'native',
    'preload',
    'inline',
    'grouped',
    'seconds',
    'reorderable',
    'collapsible',
    'collapsed',
    'cloneable',
    'aside',
    'compact',
    'badge',
    'copyable',
    'lineNumbers',
    'markdown',
    'since',
    'circular',
    'addable',
    'deletable',
    'previewable',
    'imageEditor',
    'downloadable',
    'image',
    'alpha',
    'alphaNumeric',
    'confirmed',
    'range',
    'email',
    'url',
    'autosize',
    'tel',
    'multiple',
  ].map((name) => [name, true])
)
const fieldKinds: Record<string, true> = Object.fromEntries(
  [
    'slider',
    'text',
    'email',
    'password',
    'number',
    'textarea',
    'hidden',
    'select',
    'multiSelect',
    'checkbox',
    'checkboxList',
    'radio',
    'toggle',
    'toggleButtons',
    'date',
    'dateTime',
    'time',
    'slider',
    'color',
    'tags',
    'keyValue',
    'markdownEditor',
    'codeEditor',
    'richEditor',
    'fileUpload',
    'builder',
    'repeater',
  ].map((name) => [name, true])
)
function setOption(
  definition: SchemaNodeDefinition,
  key: string,
  value: unknown
): SchemaNodeDefinition {
  if (definition.kind === 'slider' && (key === 'min' || key === 'max' || key === 'step'))
    return { ...definition, [key]: value } as SchemaNodeDefinition
  if (key in validatorMethods && definition.kind in fieldKinds) {
    const fieldDefinition = definition as FieldDefinitionUnion
    const rules = key === 'rules' ? { custom: value as readonly unknown[] } : { [key]: value }
    return {
      ...fieldDefinition,
      rules: { ...fieldDefinition.rules, ...rules },
    } as SchemaNodeDefinition
  }
  return { ...definition, [key]: value } as SchemaNodeDefinition
}
function createNode<D extends SchemaNodeDefinition>(definition: D): SchemaNodeBuilder {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'toDefinition') return () => definition
        if (typeof property !== 'string' || !methodMap[definition.kind].includes(property))
          return undefined
        return (...args: unknown[]) => {
          if (property === 'relationship') {
            if (definition.kind === 'repeater') {
              const options = args[1] as Omit<RepeaterRelationshipOptions, 'name'> | undefined
              return createNode({
                ...definition,
                relationship: {
                  name: String(args[0]),
                  ...(options?.orderColumn ? { orderColumn: options.orderColumn } : {}),
                },
              } as SchemaNodeDefinition)
            }
            const relationship: RelationshipOptions = {
              name: String(args[0]),
              titleColumn: String(args[1]),
              ...(typeof args[2] === 'function'
                ? { scope: args[2] as RelationshipOptions['scope'] }
                : {}),
            }
            return createNode(setOption(definition, property, relationship))
          }
          if (property === 'hintIcon') {
            const options = args[1] as { tooltip?: string } | undefined
            return createNode({
              ...definition,
              hintIcon: String(args[0]),
              ...(options?.tooltip ? { hintTooltip: options.tooltip } : {}),
            } as SchemaNodeDefinition)
          }
          const value = args[0] === undefined && property in booleanDefaultMethods ? true : args[0]
          if (property === 'fileAttachments' && value && typeof value === 'object') {
            const options = value as { disk?: string; directory?: string }
            return createNode({
              ...definition,
              ...(options.disk ? { fileAttachmentsDisk: options.disk } : {}),
              ...(options.directory ? { fileAttachmentsDirectory: options.directory } : {}),
            } as SchemaNodeDefinition)
          }
          if (property === 'createOptionForm' && Array.isArray(value)) {
            return createNode(
              setOption(
                definition,
                property,
                (value as readonly AnyBuilder[]).map((child) => child.toDefinition())
              )
            )
          }
          if (
            (property === 'prefixAction' ||
              property === 'suffixAction' ||
              property === 'hintAction') &&
            value
          ) {
            const action =
              typeof value === 'object' && 'definition' in value ? value.definition : value
            return createNode(setOption(definition, property, action))
          }
          if (property === 'blocks' && Array.isArray(value)) {
            return createNode({
              ...definition,
              blocks: (value as readonly BuilderBlockBuilder[]).map((block) =>
                block.toDefinition()
              ),
            } as SchemaNodeDefinition)
          }
          if (property === 'steps' && Array.isArray(value)) {
            return createNode({
              ...definition,
              steps: (value as readonly AnyBuilder[]).map((step) => step.toDefinition()),
            } as SchemaNodeDefinition)
          }
          if (property === 'components' || (property === 'schema' && Array.isArray(value))) {
            const components = (value as readonly AnyBuilder[]).map((child) => child.toDefinition())
            const key =
              definition.kind === 'repeater' || definition.kind === 'repeatableEntry'
                ? 'schema'
                : 'children'
            return createNode({ ...definition, [key]: components } as SchemaNodeDefinition)
          }
          return createNode(setOption(definition, property, value))
        }
      },
    }
  ) as SchemaNodeBuilder
}
function field(kind: SchemaKind, name: string): SchemaNodeBuilder {
  return createNode({ kind, name } as FieldDefinitionUnion)
}
function layout(
  kind: LayoutDefinition['kind'],
  name?: string,
  initial: Record<string, unknown> = {}
): SchemaNodeBuilder {
  return createNode({
    kind,
    ...(name ? { name } : {}),
    ...initial,
    ...(kind === 'grid' ||
    kind === 'section' ||
    kind === 'fieldset' ||
    kind === 'tabs' ||
    kind === 'tab' ||
    kind === 'group' ||
    kind === 'split' ||
    kind === 'fragment'
      ? { children: [] }
      : {}),
  } as LayoutDefinition)
}
const fields = [
  'slider',
  'text',
  'email',
  'password',
  'number',
  'textarea',
  'hidden',
  'select',
  'multiSelect',
  'checkbox',
  'checkboxList',
  'radio',
  'toggle',
  'toggleButtons',
  'date',
  'dateTime',
  'time',
  'color',
  'tags',
  'keyValue',
  'markdownEditor',
  'codeEditor',
  'richEditor',
  'fileUpload',
  'builder',
  'repeater',
  'textEntry',
  'iconEntry',
  'imageEntry',
  'colorEntry',
  'keyValueEntry',
  'repeatableEntry',
  'codeEntry',
  'badgeEntry',
] as const
const factories = Object.fromEntries(
  fields.map((kind) => [kind, (name: string) => field(kind, name)])
)
export const schema = Object.assign(factories, {
  grid: () => layout('grid'),
  section: (heading?: string) => layout('section', undefined, heading ? { heading } : {}),
  fieldset: (label?: string) => layout('fieldset', undefined, label ? { label } : {}),
  block: (name: string) => {
    const createBlock = (definition: BuilderBlockDefinition): BuilderBlockBuilder =>
      new Proxy(
        {},
        {
          get(_target, property) {
            if (property === 'toDefinition') return () => definition
            if (property === 'label' || property === 'icon')
              return (value: string) => createBlock({ ...definition, [property]: value })
            if (property === 'schema')
              return (
                value:
                  | readonly AnyBuilder[]
                  | ((blockFields: BlockSchemaNamespace) => readonly AnyBuilder[])
              ) => {
                const blockSchema =
                  typeof value === 'function' ? value(schema as BlockSchemaNamespace) : value
                return createBlock({
                  ...definition,
                  schema: blockSchema.map((child) => child.toDefinition()),
                })
              }
            return undefined
          },
        }
      ) as BuilderBlockBuilder
    return createBlock({ kind: 'block', name, schema: [] })
  },
  wizard: (steps: readonly AnyBuilder[] = []) =>
    createNode({ kind: 'wizard', steps: steps.map((step) => step.toDefinition()) } as never),
  step: (name: string) => createNode({ kind: 'step', name, children: [] } as never),
  tabs: (tabs: readonly AnyBuilder[] = []) =>
    createNode({ kind: 'tabs', children: tabs.map((tab) => tab.toDefinition()) }),
  tab: (name: string) => layout('tab', name),
  group: (name?: string) => layout('group', name),
  split: (...children: readonly AnyBuilder[]) =>
    createNode({ kind: 'split', children: children.map((child) => child.toDefinition()) }),
  placeholder: (name: string) => layout('placeholder', name),
  html: (content?: string) => layout('html', undefined, content === undefined ? {} : { content }),
  divider: () => layout('divider'),
  view: (component: string, props: Record<string, unknown> = {}) =>
    layout('view', undefined, { component, props }),
  fragment: (children: readonly AnyBuilder[] = []) =>
    createNode({ kind: 'fragment', children: children.map((child) => child.toDefinition()) }),
}) as unknown as SchemaNamespace
export function getComponentDefinition(component: SchemaNodeBuilder): ComponentDefinition {
  return component.toDefinition()
}
export function createFormSchema<M>(): FormSchema<M> {
  const fieldSchema = schema as SchemaNamespace
  return Object.assign({}, fieldSchema, {
    components: (items: readonly SchemaNodeBuilder[]) => ({
      components: items.map(getComponentDefinition),
    }),
    entries: (items: readonly SchemaNodeBuilder[]) => ({
      entries: items.map(getComponentDefinition),
    }),
  }) as FormSchema<M>
}
