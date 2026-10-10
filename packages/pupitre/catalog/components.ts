import { z } from 'zod'
import { dynamic } from './expressions.js'
import {
  actionDescriptor,
  fileUploadDescriptor,
  formDescriptor,
  option,
  repeaterDescriptor,
  tableDescriptor,
} from './wire.js'

const str = dynamic(z.string())
const nullableStr = dynamic(z.string().nullable())
const bool = dynamic(z.boolean())
const num = dynamic(z.number())
const common = {
  name: z.string().optional(),
  label: nullableStr.optional(),
  helperText: nullableStr.optional(),
  hint: nullableStr.optional(),
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

export const repeaterItemEvents = ['remove', 'move', 'clone', 'collapse'] as const
export const repeaterEvents = ['add', 'remove', 'move', 'clone', 'collapse'] as const
export const dataTableEvents = ['reload', 'column', 'reorder', 'action'] as const
export const actionBarEvents = ['action'] as const
export const formEvents = ['submit', 'cancel'] as const
export const catalogEvents = {
  RepeaterItem: repeaterItemEvents,
  Repeater: repeaterEvents,
  DataTable: dataTableEvents,
  ActionBar: actionBarEvents,
  Form: formEvents,
} as const

export const components = {
  Text: leaf({
    ...valueProps(z.string().nullable()),
    type: z.enum(['text', 'email', 'password', 'url', 'tel']).optional(),
    placeholder: str.optional(),
    prefix: str.optional(),
    suffix: str.optional(),
    prefixIcon: str.optional(),
    suffixIcon: str.optional(),
    maxLength: num.optional(),
    mask: str.optional(),
    autocomplete: str.optional(),
    datalist: dynamic(z.array(z.string())).optional(),
    revealable: bool.optional(),
  }),
  Textarea: leaf({
    ...valueProps(z.string().nullable()),
    rows: num.optional(),
    autosize: bool.optional(),
    maxLength: num.optional(),
    placeholder: str.optional(),
  }),
  Number: leaf({
    ...valueProps(z.number().nullable()),
    min: num.optional(),
    max: num.optional(),
    step: num.optional(),
    prefix: str.optional(),
    suffix: str.optional(),
    inputMode: z.enum(['numeric', 'decimal']).optional(),
  }),
  Hidden: leaf({ ...valueProps(z.unknown()) }),
  Select: leaf({
    ...valueProps(
      z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])), z.null()])
    ),
    options: optionList.optional(),
    searchable: bool.optional(),
    multiple: bool.optional(),
    native: bool.optional(),
    placeholder: str.optional(),
    optionsUrl: str.optional(),
    preload: bool.optional(),
    createOption: z.object({ url: z.string() }).optional(),
    clearable: bool.optional(),
  }),
  Checkbox: leaf({ ...valueProps(z.boolean()), inline: bool.optional() }),
  CheckboxList: leaf({
    ...valueProps(z.array(z.union([z.string(), z.number()]))),
    options: optionList.optional(),
    columns: num.optional(),
    searchable: bool.optional(),
    bulkToggleable: bool.optional(),
  }),
  Radio: leaf({
    ...valueProps(z.union([z.string(), z.number(), z.null()])),
    options: optionList.optional(),
    inline: bool.optional(),
    descriptions: dynamic(z.record(z.string(), z.string())).optional(),
  }),
  Toggle: leaf({
    ...valueProps(z.boolean()),
    onIcon: str.optional(),
    offIcon: str.optional(),
    onColor: str.optional(),
    offColor: str.optional(),
    inline: bool.optional(),
  }),
  ToggleButtons: leaf({
    ...valueProps(
      z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])), z.null()])
    ),
    options: optionList.optional(),
    multiple: bool.optional(),
    grouped: bool.optional(),
    icons: dynamic(z.record(z.string(), z.string())).optional(),
    colors: dynamic(z.record(z.string(), z.string())).optional(),
  }),
  Date: leaf({
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
  DateTime: leaf({
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
  Time: leaf({
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
  Color: leaf({
    ...valueProps(z.string()),
    format: z.enum(['hex', 'rgb', 'hsl']).optional(),
    presets: dynamic(z.array(z.string())).optional(),
  }),
  Tags: leaf({
    ...valueProps(z.array(z.string())),
    suggestions: dynamic(z.array(z.string())).optional(),
    separator: str.optional(),
    maxTags: num.optional(),
    reorderable: bool.optional(),
  }),
  KeyValue: leaf({
    ...valueProps(z.record(z.string(), z.string())),
    keyLabel: str.optional(),
    valueLabel: str.optional(),
    addable: bool.optional(),
    deletable: bool.optional(),
    reorderable: bool.optional(),
    keyPlaceholder: str.optional(),
    valuePlaceholder: str.optional(),
  }),
  RichEditor: leaf({
    ...valueProps(z.string().nullable()),
    toolbar: dynamic(z.array(z.string())).optional(),
    uploadUrl: str.optional(),
    minHeight: num.optional(),
    maxHeight: num.optional(),
  }),
  FileUpload: leaf({
    ...valueProps(z.union([z.string(), z.array(z.string()), z.null()])),
    descriptor: fileUploadDescriptor,
  }),
  Repeater: container(
    { descriptor: repeaterDescriptor },
    'Repeater emits add, remove, move, clone, and collapse events.'
  ),
  RepeaterItem: container(
    {
      index: dynamic(z.number()),
      collapsed: bool.optional(),
      itemLabel: str.optional(),
    },
    'RepeaterItem emits remove, move, clone, and collapse events.'
  ),
  Form: container({ ...formDescriptor.shape, ...common }, 'Form emits submit and cancel events.'),
  Grid: container({
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
  Section: container({
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
  Fieldset: container({ ...common, columns: num.optional() }),
  Tabs: container({
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
  Tab: container({
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
  Group: container({ relationship: str.optional(), ...common }),
  Split: container({ from: z.enum(['md', 'lg']), ratio: num.optional(), ...common }),
  Placeholder: leaf({
    content: dynamic(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    ...common,
  }),
  Html: leaf({ content: str, ...common }),
  Divider: leaf({ ...common }),
  Actions: leaf({
    actions: dynamic(z.array(actionDescriptor)),
    alignment: z.enum(['start', 'center', 'end']).optional(),
    fullWidth: bool.optional(),
  }),
  View: container({
    component: z.string(),
    props: z.record(z.string(), z.unknown()).optional(),
    ...common,
  }),
  Fragment: container({ ...common }),
  DataTable: leaf(
    { descriptor: tableDescriptor, ...common },
    'DataTable emits reload, column, reorder, and action events.'
  ),
  ActionBar: leaf(
    { actions: dynamic(z.array(actionDescriptor)), ...common },
    'ActionBar emits action events.'
  ),
  Infolist: container({ ...common }),
  TextEntry: leaf({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  IconEntry: leaf({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  ImageEntry: leaf({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  ColorEntry: leaf({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  KeyValueEntry: leaf({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  RepeatableEntry: container({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  CodeEntry: leaf({
    label: nullableStr.optional(),
    value: z.unknown().optional(),
    copyable: bool.optional(),
    url: str.optional(),
    color: str.optional(),
    icon: str.optional(),
    placeholder: str.optional(),
    columnSpan: dynamic(z.union([z.number(), z.literal('full')])).optional(),
  }),
  BadgeEntry: leaf({
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
  Text: 'Captures one line of text with optional input affordances.',
  Textarea: 'Captures multiline text with optional autosizing.',
  Number: 'Captures a numeric value with range and step constraints.',
  Hidden: 'Carries a value in form state without rendering a visible control.',
  Select: 'Selects one or more values from static or fetched options.',
  Checkbox: 'Captures a single boolean choice.',
  CheckboxList: 'Selects multiple values from a visible option list.',
  Radio: 'Selects one value from mutually exclusive options.',
  Toggle: 'Switches a boolean setting on or off.',
  ToggleButtons: 'Selects one or multiple values using a button group.',
  Date: 'Captures a calendar date.',
  DateTime: 'Captures a date and time in the configured timezone.',
  Time: 'Captures a time of day.',
  Color: 'Captures a color value in the selected color format.',
  Tags: 'Edits an ordered list of text tags.',
  KeyValue: 'Edits a string-to-string key-value collection.',
  RichEditor: 'Edits formatted HTML content with a configurable toolbar.',
  FileUpload: 'Uploads, previews, reorders, and manages file keys.',
  Repeater:
    'Renders and manages a repeated collection; emits add, remove, move, clone, and collapse.',
  RepeaterItem: 'Renders one repeated item; emits remove, move, clone, and collapse.',
  Form: 'Submits form state to its configured endpoint; emits submit and cancel.',
  Grid: 'Arranges child components in a responsive column grid.',
  Section: 'Groups related content under an optional heading and collapse control.',
  Fieldset: 'Groups related fields under a fieldset label.',
  Tabs: 'Selects a tab while keeping each tab panel mounted.',
  Tab: 'Defines one panel within its parent Tabs component.',
  Group: 'Groups child components and may annotate a relationship.',
  Split: 'Places two child regions side by side at a responsive breakpoint.',
  Placeholder: 'Displays literal or expression-derived placeholder content.',
  Html: 'Displays server-sanitized HTML content.',
  Divider: 'Separates adjacent content visually.',
  Actions: 'Renders a collection of action descriptors.',
  View: 'Renders a named host-registered component with supplied props.',
  Fragment: 'Groups child components without adding a wrapper.',
  DataTable: 'Renders server-provided table data; emits reload, column, reorder, and action.',
  ActionBar: 'Renders available actions; emits action when one is selected.',
  Infolist: 'Groups read-only entries describing a record.',
  TextEntry: 'Displays a formatted text value with optional copy and link actions.',
  IconEntry: 'Displays a formatted icon value.',
  ImageEntry: 'Displays an image value.',
  ColorEntry: 'Displays a formatted color value.',
  KeyValueEntry: 'Displays a formatted key-value collection.',
  RepeatableEntry: 'Renders a read-only repeated collection.',
  CodeEntry: 'Displays a formatted code value.',
  BadgeEntry: 'Displays a formatted value as a badge.',
}

for (const name of Object.keys(components) as Array<keyof typeof components>) {
  components[name].description = componentDescriptions[name]
}
