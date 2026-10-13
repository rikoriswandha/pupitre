import './csp.js'

import { z } from 'zod'
import { dynamic } from './expressions.js'
import {
  actionDescriptor,
  fileUploadDescriptor,
  formDescriptor,
  builderDescriptor,
  option,
  repeaterDescriptor,
  tableDescriptor,
  widgetDescriptor,
  relationDescriptor,
} from './wire.js'

const str = dynamic(z.string())
const nullableStr = dynamic(z.string().nullable())
const bool = dynamic(z.boolean())
const num = dynamic(z.number())
const liveProp = z
  .union([
    z.boolean(),
    z.object({ onBlur: z.boolean().optional(), debounce: z.number().nonnegative().optional() }),
  ])
  .optional()
const common = {
  name: z.string().optional(),
  label: nullableStr.optional(),
  helperText: nullableStr.optional(),
  hint: nullableStr.optional(),
  hintIcon: str.optional(),
  hintColor: str.optional(),
  hintAction: actionDescriptor.optional(),
  hintTooltip: str.optional(),
  required: bool.optional(),
  disabled: bool.optional(),
  readOnly: bool.optional(),
  value: dynamic(
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.unknown()),
      z.record(z.string(), z.unknown()),
      z.null(),
    ])
  ).optional(),
  error: nullableStr.optional(),
  columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  extraAttributes: z.record(z.string(), z.string()).optional(),
}
const valueProps = <T extends z.ZodType>(valueSchema: T) => ({
  ...common,
  value: dynamic(valueSchema).optional(),
})
const leaf = <T extends z.ZodRawShape>(props: T, description = 'Pupitre catalog component.') => ({
  props: z.object(props),
  slots: [] as string[],
  description,
})
const container = <T extends z.ZodRawShape>(
  props: T,
  description = 'Pupitre catalog container.'
) => ({
  props: z.object(props),
  slots: ['default'],
  description,
})
const optionList = dynamic(z.array(option))

/**
 * Events the compiler binds through json-render `on`. json-render events carry
 * no runtime payload, so everything that needs one (row actions, table query
 * changes, item reordering, uploads) goes through pupitre-react hooks instead.
 */
export const catalogEvents = {
  Repeater: ['add'],
} as const

export const components = {
  'Text': leaf({
    ...valueProps(z.string().nullable()),
    live: liveProp,
    type: z.enum(['text', 'email', 'password', 'url', 'tel']).optional(),
    placeholder: str.optional(),
    prefix: str.optional(),
    suffix: str.optional(),
    prefixIcon: str.optional(),
    suffixIcon: str.optional(),
    maxLength: num.optional(),
    mask: str.optional(),
    prefixAction: actionDescriptor.optional(),
    suffixAction: actionDescriptor.optional(),
    autocomplete: str.optional(),
    datalist: dynamic(z.array(z.string())).optional(),
    revealable: bool.optional(),
  }),
  'Textarea': leaf({
    ...valueProps(z.string().nullable()),
    live: liveProp,
    rows: num.optional(),
    autosize: bool.optional(),
    maxLength: num.optional(),
    placeholder: str.optional(),
  }),
  'Number': leaf({
    ...valueProps(z.number().nullable()),
    live: liveProp,
    min: num.optional(),
    max: num.optional(),
    step: num.optional(),
    prefix: str.optional(),
    suffix: str.optional(),
    inputMode: z.enum(['numeric', 'decimal']).optional(),
  }),
  'Slider': leaf({
    ...valueProps(z.union([z.number(), z.tuple([z.number(), z.number()]), z.null()])),
    min: num.optional(),
    max: num.optional(),
    step: num.optional(),
    marks: dynamic(z.array(z.number())).optional(),
    range: bool.optional(),
  }),
  'Hidden': leaf({ ...valueProps(z.unknown()) }),
  'Select': leaf({
    ...valueProps(
      z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])), z.null()])
    ),
    options: optionList.optional(),
    searchable: z.union([bool, z.array(z.string())]).optional(),
    multiple: bool.optional(),
    native: bool.optional(),
    placeholder: str.optional(),
    optionsUrl: str.optional(),
    preload: bool.optional(),
    createOption: z.object({ url: str }).optional(),
    prefixAction: actionDescriptor.optional(),
    suffixAction: actionDescriptor.optional(),
    clearable: bool.optional(),
  }),
  'Checkbox': leaf({ ...valueProps(z.boolean()), inline: bool.optional() }),
  'CheckboxList': leaf({
    ...valueProps(z.array(z.union([z.string(), z.number()]))),
    options: optionList.optional(),
    columns: num.optional(),
    searchable: bool.optional(),
    bulkToggleable: bool.optional(),
  }),
  'Radio': leaf({
    ...valueProps(z.union([z.string(), z.number(), z.null()])),
    options: optionList.optional(),
    inline: bool.optional(),
    descriptions: dynamic(z.record(z.string(), z.string())).optional(),
  }),
  'Toggle': leaf({
    ...valueProps(z.boolean()),
    onIcon: str.optional(),
    offIcon: str.optional(),
    onColor: str.optional(),
    offColor: str.optional(),
    inline: bool.optional(),
  }),
  'ToggleButtons': leaf({
    ...valueProps(
      z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])), z.null()])
    ),
    options: optionList.optional(),
    multiple: bool.optional(),
    grouped: bool.optional(),
    icons: dynamic(z.record(z.string(), z.string())).optional(),
    colors: dynamic(z.record(z.string(), z.string())).optional(),
  }),
  'Date': leaf({
    ...valueProps(z.string().nullable()),
    min: str.optional(),
    max: str.optional(),
    displayFormat: str.optional(),
    timezone: str.optional(),
    seconds: bool.optional(),
    native: bool.optional(),
    weekStartsOn: num.optional(),
    disabledDates: dynamic(z.array(z.string())).optional(),
  }),
  'DateTime': leaf({
    ...valueProps(z.string().nullable()),
    min: str.optional(),
    max: str.optional(),
    displayFormat: str.optional(),
    timezone: str.optional(),
    seconds: bool.optional(),
    native: bool.optional(),
    weekStartsOn: num.optional(),
    disabledDates: dynamic(z.array(z.string())).optional(),
  }),
  'Time': leaf({
    ...valueProps(z.string().nullable()),
    min: str.optional(),
    max: str.optional(),
    displayFormat: str.optional(),
    timezone: str.optional(),
    seconds: bool.optional(),
    native: bool.optional(),
    weekStartsOn: num.optional(),
    disabledDates: dynamic(z.array(z.string())).optional(),
  }),
  'Color': leaf({
    ...valueProps(z.string()),
    format: z.enum(['hex', 'rgb', 'hsl']).optional(),
    presets: dynamic(z.array(z.string())).optional(),
  }),
  'Tags': leaf({
    ...valueProps(z.array(z.string())),
    live: liveProp,
    suggestions: dynamic(z.array(z.string())).optional(),
    separator: str.optional(),
    maxTags: num.optional(),
    reorderable: bool.optional(),
  }),
  'KeyValue': leaf({
    ...valueProps(z.record(z.string(), z.string())),
    keyLabel: str.optional(),
    live: liveProp,
    valueLabel: str.optional(),
    addable: bool.optional(),
    deletable: bool.optional(),
    reorderable: bool.optional(),
    keyPlaceholder: str.optional(),
    valuePlaceholder: str.optional(),
  }),
  'RichEditor': leaf({
    ...valueProps(z.string().nullable()),
    toolbar: dynamic(z.array(z.string())).optional(),
    uploadUrl: str.optional(),
    minHeight: num.optional(),
    maxHeight: num.optional(),
    mergeTags: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
    mentions: z
      .array(
        z.object({
          char: z.string(),
          options: z
            .array(z.object({ id: z.union([z.string(), z.number()]), label: z.string() }))
            .optional(),
        })
      )
      .optional(),
    optionsUrl: str.optional(),
    customBlocks: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          icon: z.string().optional(),
          spec: z.unknown(),
          state: z.record(z.string(), z.unknown()),
        })
      )
      .optional(),
  }),
  'MarkdownEditor': leaf({
    ...valueProps(z.string().nullable()),
    toolbar: dynamic(z.array(z.string())).optional(),
    uploadUrl: str.optional(),
    preview: bool.optional(),
  }),
  'CodeEditor': leaf({
    ...valueProps(z.string().nullable()),
    language: z
      .enum(['json', 'javascript', 'typescript', 'html', 'css', 'markdown', 'sql', 'python', 'php'])
      .optional(),
    lineNumbers: bool.optional(),
    minHeight: num.optional(),
  }),
  'FileUpload': leaf({
    ...valueProps(z.union([z.string(), z.array(z.string()), z.null()])),
    descriptor: fileUploadDescriptor,
  }),
  'Repeater': container(
    {
      ...common,
      descriptor: repeaterDescriptor,
      value: dynamic(z.array(z.unknown())).optional(),
    },
    'Repeater emits add, remove, move, clone, and collapse events.'
  ),
  'RepeaterItem': container(
    {
      index: dynamic(z.number()),
      collapsed: bool.optional(),
      itemLabel: str.optional(),
    },
    'RepeaterItem emits remove, move, clone, and collapse events.'
  ),
  'Builder': container(
    {
      ...common,
      descriptor: builderDescriptor,
      value: dynamic(z.array(z.unknown())).optional(),
    },
    'Builder manages typed content blocks using block templates.'
  ),
  'BuilderItem': container(
    { block: z.string(), index: dynamic(z.number()) },
    'BuilderItem renders one typed content block.'
  ),
  'Form': container({ ...formDescriptor.shape, ...common }, 'Form emits submit and cancel events.'),
  'Grid': container({
    columns: dynamic(
      z.union([
        z.number(),
        z.object({
          default: z.number().optional(),
          sm: z.number().optional(),
          md: z.number().optional(),
          lg: z.number().optional(),
          xl: z.number().optional(),
        }),
      ])
    ).optional(),
    gap: num.optional(),
  }),
  'Section': container({
    heading: str.optional(),
    description: str.optional(),
    icon: str.optional(),
    collapsible: bool.optional(),
    collapsed: bool.optional(),
    aside: str.optional(),
    compact: bool.optional(),
    columns: num.optional(),
    footerActions: dynamic(z.array(actionDescriptor)).optional(),
    ...common,
  }),
  'Fieldset': container({ ...common, columns: num.optional() }),
  'Tabs': container({
    id: z.string(),
    tabs: dynamic(
      z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          icon: z.string().optional(),
          badge: z.union([z.string(), z.number()]).optional(),
        })
      )
    ),
    active: str.optional(),
    persistInUrl: bool.optional(),
  }),
  'Tab': container({
    key: z.string(),
    label: str,
    helperText: nullableStr.optional(),
    hint: nullableStr.optional(),
    required: bool.optional(),
    disabled: bool.optional(),
    readOnly: bool.optional(),
    value: common.value,
    error: nullableStr.optional(),
    columnSpan: common.columnSpan,
    extraAttributes: common.extraAttributes,
  }),
  'Wizard': container({
    id: z.string(),
    steps: dynamic(
      z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          description: z.string().optional(),
          icon: z.string().optional(),
          fields: z.array(z.string()).optional(),
        })
      )
    ),
    step: dynamic(z.number()),
    skippable: bool.optional(),
    submitLabel: str.optional(),
  }),
  'Step': container({
    key: z.string(),
    label: str,
    description: str.optional(),
    icon: str.optional(),
  }),
  'Group': container({ relationship: str.optional(), ...common }),
  'Split': container({ from: z.enum(['md', 'lg']), ratio: num.optional(), ...common }),
  'Placeholder': leaf({
    content: dynamic(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    ...common,
  }),
  'Html': leaf({ content: str, ...common }),
  'Divider': leaf({ ...common }),
  'Actions': leaf({
    actions: dynamic(z.array(actionDescriptor)),
    alignment: z.enum(['start', 'center', 'end']).optional(),
    fullWidth: bool.optional(),
  }),
  'View': container({
    component: z.string(),
    props: z.record(z.string(), z.unknown()).optional(),
    ...common,
  }),
  'Fragment': container({ ...common }),
  'DataTable': leaf(
    { descriptor: tableDescriptor, ...common },
    'DataTable emits reload, column, reorder, and action events.'
  ),
  'Widget.Stats': leaf(
    { descriptor: widgetDescriptor, data: z.unknown().optional() },
    'Displays statistics and optional sparkline data.'
  ),
  'Widget.Chart': leaf(
    { descriptor: widgetDescriptor, data: z.unknown().optional() },
    'Displays chart data using a lazy chart renderer.'
  ),
  'Widget.Table': leaf(
    { descriptor: widgetDescriptor, data: z.unknown().optional() },
    'Displays table widget data.'
  ),
  'Widget.Timeline': leaf(
    { descriptor: widgetDescriptor, data: z.unknown().optional() },
    'Displays chronological activity with actors, timestamps, and field changes.'
  ),
  'RelationManager': leaf(
    { descriptor: relationDescriptor, ...common },
    'RelationManager shows one related table with contextual badge, actions, and read-only state.'
  ),
  'ActionBar': leaf(
    { actions: dynamic(z.array(actionDescriptor)), ...common },
    'ActionBar emits action events.'
  ),
  'Infolist': container({ ...common }),
  'TextEntry': leaf({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    html: bool.optional(),
    markdown: bool.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  'IconEntry': leaf({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  'ImageEntry': leaf({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  'ColorEntry': leaf({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  'KeyValueEntry': leaf({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  'RepeatableEntry': container({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    entries: z
      .array(
        z.object({
          name: z.string(),
          label: z.string().nullable().optional(),
          component: z.string().optional(),
          props: z.record(z.string(), z.unknown()).optional(),
        })
      )
      .optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  'CodeEntry': leaf({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  'BadgeEntry': leaf({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
} satisfies Record<string, { props: z.ZodObject<any>; slots: string[]; description: string }>
const componentDescriptions: Record<keyof typeof components, string> = {
  'Text': 'Captures one line of text with optional input affordances.',
  'Textarea': 'Captures multiline text with optional autosizing.',
  'Number': 'Captures a numeric value with range and step constraints.',
  'Slider': 'Adjusts one value or a bounded pair using accessible range controls.',
  'MarkdownEditor': 'Edits Markdown source and renders a sanitized preview.',
  'CodeEditor': 'Edits source code using a language-specific code editor.',
  'Hidden': 'Carries a value in form state without rendering a visible control.',
  'Select': 'Selects one or more values from static or fetched options.',
  'Checkbox': 'Captures a single boolean choice.',
  'CheckboxList': 'Selects multiple values from a visible option list.',
  'Radio': 'Selects one value from mutually exclusive options.',
  'Toggle': 'Switches a boolean setting on or off.',
  'ToggleButtons': 'Selects one or multiple values using a button group.',
  'Date': 'Captures a calendar date.',
  'DateTime': 'Captures a date and time in the configured timezone.',
  'Time': 'Captures a time of day.',
  'Color': 'Captures a color value in the selected color format.',
  'Tags': 'Edits an ordered list of text tags.',
  'KeyValue': 'Edits a string-to-string key-value collection.',
  'RichEditor': 'Edits formatted HTML content with a configurable toolbar.',
  'FileUpload': 'Uploads, previews, reorders, and manages file keys.',
  'Repeater':
    'Renders and manages a repeated collection; emits add, remove, move, clone, and collapse.',
  'RepeaterItem': 'Renders one repeated item; emits remove, move, clone, and collapse.',
  'Builder': 'Adds and edits typed content blocks.',
  'BuilderItem': 'Renders the fields for one content block.',
  'Form': 'Submits form state to its configured endpoint; emits submit and cancel.',
  'Grid': 'Arranges child components in a responsive column grid.',
  'Section': 'Groups related content under an optional heading and collapse control.',
  'Fieldset': 'Groups related fields under a fieldset label.',
  'Tabs': 'Selects a tab while keeping each tab panel mounted.',
  'Tab': 'Defines one panel within its parent Tabs component.',
  'Wizard': 'Shows one step of a multi-step form while keeping every step mounted.',
  'Step': 'Defines one wizard step.',
  'Group': 'Groups child components and may annotate a relationship.',
  'Split': 'Places two child regions side by side at a responsive breakpoint.',
  'Placeholder': 'Displays literal or expression-derived placeholder content.',
  'Html': 'Displays server-sanitized HTML content.',
  'Divider': 'Separates adjacent content visually.',
  'Actions': 'Renders a collection of action descriptors.',
  'View': 'Renders a named host-registered component with supplied props.',
  'Fragment': 'Groups child components without adding a wrapper.',
  'DataTable': 'Renders server-provided table data; emits reload, column, reorder, and action.',
  'Widget.Stats': 'Displays statistics and sparkline data.',
  'Widget.Chart': 'Displays a chart widget.',
  'Widget.Table': 'Displays table widget data.',
  'Widget.Timeline': 'Displays activity timestamps, actors, and field changes.',
  'RelationManager': 'Renders one relation-manager table and its contextual badge.',
  'ActionBar': 'Renders available actions; emits action when one is selected.',
  'Infolist': 'Groups read-only entries describing a record.',
  'TextEntry': 'Displays a formatted text value with optional copy and link actions.',
  'IconEntry': 'Displays a formatted icon value.',
  'ImageEntry': 'Displays an image value.',
  'ColorEntry': 'Displays a formatted color value.',
  'KeyValueEntry': 'Displays a formatted key-value collection.',
  'RepeatableEntry': 'Renders a read-only repeated collection.',
  'CodeEntry': 'Displays a formatted code value.',
  'BadgeEntry': 'Displays a formatted value as a badge.',
}

for (const name of Object.keys(components) as Array<keyof typeof components>) {
  components[name].description = componentDescriptions[name]
}
