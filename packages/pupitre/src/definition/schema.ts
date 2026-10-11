import type { HttpContext } from '@adonisjs/core/http'
import type { ActionBuilder, ActionDefinition } from './action.js'
import type { ModelQueryBuilderContract, LucidModel } from '@adonisjs/lucid/types/model'

export type SchemaKind =
  | 'text'
  | 'email'
  | 'password'
  | 'slider'
  | 'number'
  | 'textarea'
  | 'hidden'
  | 'select'
  | 'multiSelect'
  | 'checkbox'
  | 'checkboxList'
  | 'radio'
  | 'toggle'
  | 'toggleButtons'
  | 'date'
  | 'dateTime'
  | 'time'
  | 'color'
  | 'tags'
  | 'keyValue'
  | 'markdownEditor'
  | 'codeEditor'
  | 'richEditor'
  | 'fileUpload'
  | 'builder'
  | 'repeater'
  | 'grid'
  | 'section'
  | 'fieldset'
  | 'tabs'
  | 'tab'
  | 'group'
  | 'split'
  | 'placeholder'
  | 'html'
  | 'divider'
  | 'view'
  | 'fragment'
  | 'textEntry'
  | 'iconEntry'
  | 'imageEntry'
  | 'colorEntry'
  | 'keyValueEntry'
  | 'repeatableEntry'
  | 'codeEntry'
  | 'wizard'
  | 'step'
  | 'badgeEntry'
export type FieldClosure<T = unknown> = (args: {
  get(path: string): any
  record: Record<string, unknown> | null
  ctx?: HttpContext
}) => T
export type ValidationRules = {
  required?: boolean
  nullable?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  step?: number
  email?: boolean
  url?: boolean
  regex?: RegExp | string
  alpha?: boolean
  alphaNumeric?: boolean
  in?: readonly unknown[]
  same?: string
  different?: string
  confirmed?: boolean
  unique?: { table?: string; column?: string; ignoreRecord?: boolean }
  exists?: { table: string; column: string }
  custom?: readonly unknown[]
}
export type FieldCommon = {
  label?: string | null | FieldClosure<string | null>
  helperText?: string | null
  hint?: string | null
  hintIcon?: string
  hintTooltip?: string
  hintColor?: string
  hintAction?: ActionDefinition
  placeholder?: string | null
  default?: unknown | (() => unknown)
  disabled?: boolean | FieldClosure<boolean>
  readOnly?: boolean
  visible?: FieldClosure<boolean>
  hidden?: FieldClosure<boolean>
  columnSpan?: number | 'full'
  extraAttributes?: Record<string, string>
  live?: { onBlur?: boolean; debounce?: number; server?: boolean } | true
  afterStateUpdated?: (args: {
    state: unknown
    old: unknown
    get(path: string): any
    set(path: string, value: unknown): void
    record?: Record<string, unknown> | null
    ctx?: HttpContext
  }) => unknown
  dehydrated?: boolean
  dehydratedWhenHidden?: boolean
  format?: ((record: Record<string, unknown>) => unknown) | 'hex' | 'rgb' | 'hsl'
  dehydrate?: (state: unknown) => unknown
  rules?: ValidationRules
}
export type FieldDefinition<K extends SchemaKind, P extends object = object> = FieldCommon &
  P & { kind: K; name: string }
export type TextFieldDefinition =
  | FieldDefinition<
      'text',
      {
        prefix?: string
        suffix?: string
        autocomplete?: string
        datalist?: readonly string[]
        mask?: string
        telRegex?: RegExp | string
        prefixAction?: ActionDefinition
        suffixAction?: ActionDefinition
        tel?: boolean
      }
    >
  | FieldDefinition<
      'email',
      {
        prefix?: string
        suffix?: string
        autocomplete?: string
        datalist?: readonly string[]
        mask?: string
        prefixAction?: ActionDefinition
        suffixAction?: ActionDefinition
      }
    >
  | FieldDefinition<
      'password',
      {
        prefix?: string
        suffix?: string
        autocomplete?: string
        datalist?: readonly string[]
        revealable?: boolean
        prefixAction?: ActionDefinition
        suffixAction?: ActionDefinition
      }
    >
export type NumberFieldDefinition = FieldDefinition<'number', { prefix?: string; suffix?: string }>
export type TextareaFieldDefinition = FieldDefinition<
  'textarea',
  { rows?: number; autosize?: boolean }
>
export type SliderFieldDefinition = FieldDefinition<
  'slider',
  { min?: number; max?: number; step?: number; marks?: readonly number[]; range?: boolean }
>
export type SelectOptions = Record<string, unknown> | readonly unknown[]
export type SelectOptionsContext = {
  search: string
  ctx?: HttpContext
  page: number
  /** Requested option values to resolve alongside the current search. */
  values?: (string | number)[]
}
export type RelationshipOptions = {
  name: string
  titleColumn: string
  scope?: (query: ModelQueryBuilderContract<LucidModel>, ctx: HttpContext) => unknown
}
export type SelectFieldDefinition =
  | FieldDefinition<
      'select',
      {
        options?: SelectOptions | ((args: SelectOptionsContext) => unknown | Promise<unknown>)
        native?: boolean
        clearable?: boolean
        searchable?: boolean | readonly string[]
        preload?: boolean
        relationship?: RelationshipOptions
        getOptionLabelUsing?: (value: unknown, ctx?: HttpContext) => unknown | Promise<unknown>
        createOptionForm?: SchemaNodeDefinition[]
        createOptionUsing?: (args: {
          data: Record<string, unknown>
          ctx: HttpContext
          model: unknown
        }) => unknown | Promise<unknown>
        prefixAction?: ActionDefinition
        suffixAction?: ActionDefinition
      }
    >
  | FieldDefinition<
      'multiSelect',
      {
        options?: SelectOptions | ((args: SelectOptionsContext) => unknown | Promise<unknown>)
        native?: boolean
        clearable?: boolean
        searchable?: boolean | readonly string[]
        preload?: boolean
        relationship?: RelationshipOptions
        getOptionLabelUsing?: (value: unknown, ctx?: HttpContext) => unknown | Promise<unknown>
        createOptionForm?: SchemaNodeDefinition[]
        createOptionUsing?: (args: {
          data: Record<string, unknown>
          ctx: HttpContext
          model: unknown
        }) => unknown | Promise<unknown>
        prefixAction?: ActionDefinition
        suffixAction?: ActionDefinition
      }
    >
export type CheckboxFieldDefinition = FieldDefinition<'checkbox', { inline?: boolean }>
export type CheckboxListFieldDefinition = FieldDefinition<
  'checkboxList',
  {
    options?: Record<string, unknown> | readonly unknown[]
    columns?: number
    searchable?: boolean
  }
>
export type RadioFieldDefinition = FieldDefinition<
  'radio',
  {
    options?: Record<string, unknown> | readonly unknown[]
    descriptions?: Record<string, string>
    inline?: boolean
  }
>
export type ToggleFieldDefinition = FieldDefinition<
  'toggle',
  { onIcon?: string; offIcon?: string; onColor?: string; offColor?: string; inline?: boolean }
>
export type ToggleButtonsFieldDefinition = FieldDefinition<
  'toggleButtons',
  {
    options?: Record<string, unknown> | readonly unknown[]
    multiple?: boolean
    grouped?: boolean
    icons?: Record<string, string>
    colors?: Record<string, string>
  }
>
export type DateFieldDefinition =
  | FieldDefinition<
      'date',
      {
        minDate?: string
        maxDate?: string
        timezone?: string
        seconds?: boolean
        native?: boolean
      }
    >
  | FieldDefinition<
      'dateTime',
      {
        minDate?: string
        maxDate?: string
        timezone?: string
        seconds?: boolean
        native?: boolean
      }
    >
  | FieldDefinition<
      'time',
      {
        minDate?: string
        maxDate?: string
        timezone?: string
        seconds?: boolean
        native?: boolean
      }
    >
export type ColorFieldDefinition = FieldDefinition<
  'color',
  { format?: 'hex' | 'rgb' | 'hsl'; presets?: readonly string[] }
>
export type TagsFieldDefinition = FieldDefinition<
  'tags',
  { suggestions?: readonly string[]; separator?: string; maxTags?: number; reorderable?: boolean }
>
export type KeyValueFieldDefinition = FieldDefinition<
  'keyValue',
  {
    keyLabel?: string
    valueLabel?: string
    addable?: boolean
    deletable?: boolean
    reorderable?: boolean
    keyPlaceholder?: string
    valuePlaceholder?: string
  }
>
export type MarkdownEditorFieldDefinition = FieldDefinition<
  'markdownEditor',
  {
    toolbar?: readonly string[]
    fileAttachmentsDisk?: string
    fileAttachmentsDirectory?: string
    preview?: boolean
  }
>
export type CodeEditorFieldDefinition = FieldDefinition<
  'codeEditor',
  {
    language?:
      'json' | 'javascript' | 'typescript' | 'html' | 'css' | 'markdown' | 'sql' | 'python' | 'php'
    lineNumbers?: boolean
    minHeight?: number
  }
>
export type RichEditorFieldDefinition = FieldDefinition<
  'richEditor',
  {
    toolbar?: readonly string[]
    minHeight?: number
    maxHeight?: number
    fileAttachmentsDisk?: string
    fileAttachmentsDirectory?: string
  }
>
export type FileUploadFieldDefinition = FieldDefinition<
  'fileUpload',
  {
    disk?: string
    image?: boolean
    maxSize?: number | `${number}kb` | `${number}mb`
    multiple?: boolean
    maxFiles?: number
    accept?: string | readonly string[]
    directory?: string
    visibility?: 'public' | 'private'
    reorderable?: boolean
    downloadable?: boolean
    previewable?: boolean
    imageEditor?: boolean
    imageEditorAspectRatios?: readonly (string | null)[]
  }
>
export type RepeaterRelationshipOptions = { name: string; orderColumn?: string }
export type RepeaterFieldDefinition = FieldDefinition<
  'repeater',
  {
    schema?: SchemaNodeDefinition[] | ((repeater: SchemaNamespace) => SchemaNodeDefinition[])
    minItems?: number
    maxItems?: number
    reorderable?: boolean
    collapsible?: boolean
    collapsed?: boolean
    cloneable?: boolean
    addLabel?: string
    itemLabel?: string | FieldClosure<string>
    defaultItems?: number
    grid?: number | Record<string, number>
    relationship?: RepeaterRelationshipOptions
  }
>
export type BuilderBlockDefinition = {
  kind: 'block'
  name: string
  label?: string
  icon?: string
  schema: SchemaNodeDefinition[]
}
export type BuilderFieldDefinition = FieldDefinition<
  'builder',
  {
    blocks: BuilderBlockDefinition[]
    minItems?: number
    maxItems?: number
    reorderable?: boolean
    collapsible?: boolean
    cloneable?: boolean
    addLabel?: string
    blockPickerColumns?: number
  }
>
export type WizardStepDefinition = {
  kind: 'step'
  name: string
  description?: string
  icon?: string
  children: SchemaNodeDefinition[]
}
export type WizardDefinition = {
  kind: 'wizard'
  steps: WizardStepDefinition[]
  skippable?: boolean
  startOnStep?: number
  submitLabel?: string
  visible?: FieldClosure<boolean>
  hidden?: FieldClosure<boolean>
  columnSpan?: number | 'full'
  extraAttributes?: Record<string, string>
}
export interface BuilderBlockBuilder {
  toDefinition(): BuilderBlockDefinition
  label(value: string): this
  icon(value: string): this
  schema(
    value:
      | readonly SchemaNodeBuilder[]
      | ((fields: BlockSchemaNamespace) => readonly SchemaNodeBuilder[])
  ): this
}
export interface BuilderBuilder extends FieldBuilderBase<BuilderFieldDefinition> {
  blocks(value: readonly BuilderBlockBuilder[]): this
  minItems(value: number): this
  maxItems(value: number): this
  reorderable(value?: boolean): this
  collapsible(value?: boolean): this
  cloneable(value?: boolean): this
  addLabel(value: string): this
  blockPickerColumns(value: number): this
}
export interface WizardBuilder extends LayoutBase<WizardDefinition> {
  steps(value: readonly SchemaNodeBuilder[]): this
  skippable(value?: boolean): this
  startOnStep(value: number): this
  submitLabel(value: string): this
}
export interface StepBuilder extends LayoutBase<WizardStepDefinition> {
  components(value: readonly SchemaNodeBuilder[]): this
  description(value: string): this
  icon(value: string): this
  schema(value: readonly SchemaNodeBuilder[]): this
}
export type HiddenFieldDefinition = FieldDefinition<'hidden'>
export type FieldDefinitionUnion =
  | TextFieldDefinition
  | NumberFieldDefinition
  | SliderFieldDefinition
  | TextareaFieldDefinition
  | SelectFieldDefinition
  | CheckboxFieldDefinition
  | CheckboxListFieldDefinition
  | RadioFieldDefinition
  | ToggleFieldDefinition
  | ToggleButtonsFieldDefinition
  | DateFieldDefinition
  | ColorFieldDefinition
  | TagsFieldDefinition
  | KeyValueFieldDefinition
  | MarkdownEditorFieldDefinition
  | CodeEditorFieldDefinition
  | RichEditorFieldDefinition
  | FileUploadFieldDefinition
  | RepeaterFieldDefinition
  | BuilderFieldDefinition
  | HiddenFieldDefinition
export type LayoutDefinition =
  | WizardDefinition
  | WizardStepDefinition
  | {
      kind: 'grid'
      children: SchemaNodeDefinition[]
      columns?: number | Record<string, number>
      gap?: number
      visible?: FieldClosure<boolean>
      hidden?: FieldClosure<boolean>
      columnSpan?: number | 'full'
      extraAttributes?: Record<string, string>
    }
  | {
      kind: 'section'
      children: SchemaNodeDefinition[]
      heading?: string
      description?: string
      icon?: string
      collapsible?: boolean
      collapsed?: boolean
      aside?: boolean
      compact?: boolean
      columns?: number | Record<string, number>
      visible?: FieldClosure<boolean>
      hidden?: FieldClosure<boolean>
      columnSpan?: number | 'full'
      extraAttributes?: Record<string, string>
    }
  | {
      kind: 'fieldset'
      children: SchemaNodeDefinition[]
      label?: string
      columns?: number | Record<string, number>
      visible?: FieldClosure<boolean>
      hidden?: FieldClosure<boolean>
      columnSpan?: number | 'full'
      extraAttributes?: Record<string, string>
    }
  | {
      kind: 'tabs'
      children: SchemaNodeDefinition[]
      visible?: FieldClosure<boolean>
      hidden?: FieldClosure<boolean>
      columnSpan?: number | 'full'
      extraAttributes?: Record<string, string>
    }
  | {
      kind: 'tab'
      name: string
      children: SchemaNodeDefinition[]
      visible?: FieldClosure<boolean>
      hidden?: FieldClosure<boolean>
      columnSpan?: number | 'full'
      extraAttributes?: Record<string, string>
    }
  | {
      kind: 'group'
      name?: string
      children: SchemaNodeDefinition[]
      visible?: FieldClosure<boolean>
      hidden?: FieldClosure<boolean>
      columnSpan?: number | 'full'
      extraAttributes?: Record<string, string>
    }
  | {
      kind: 'fragment'
      children: SchemaNodeDefinition[]
      visible?: FieldClosure<boolean>
      hidden?: FieldClosure<boolean>
      columnSpan?: number | 'full'
      extraAttributes?: Record<string, string>
    }
  | {
      kind: 'split'
      children: SchemaNodeDefinition[]
      columns?: number | Record<string, number>
      visible?: FieldClosure<boolean>
      hidden?: FieldClosure<boolean>
      columnSpan?: number | 'full'
      extraAttributes?: Record<string, string>
    }
  | {
      kind: 'placeholder'
      name: string
      label?: string
      content?: unknown | FieldClosure
      visible?: FieldClosure<boolean>
      hidden?: FieldClosure<boolean>
      columnSpan?: number | 'full'
      extraAttributes?: Record<string, string>
    }
  | {
      kind: 'html'
      content?: string | FieldClosure<string>
      visible?: FieldClosure<boolean>
      hidden?: FieldClosure<boolean>
      columnSpan?: number | 'full'
      extraAttributes?: Record<string, string>
    }
  | {
      kind: 'divider'
      visible?: FieldClosure<boolean>
      hidden?: FieldClosure<boolean>
      columnSpan?: number | 'full'
      extraAttributes?: Record<string, string>
    }
  | {
      kind: 'view'
      component: string
      props?: Record<string, unknown>
      visible?: FieldClosure<boolean>
      hidden?: FieldClosure<boolean>
      columnSpan?: number | 'full'
      extraAttributes?: Record<string, string>
    }
export type EntryCommon = {
  kind: string
  name: string
  label?: string | null
  hint?: string | null
  placeholder?: string | null
  columnSpan?: number | 'full'
}
export type TextEntryDefinition = EntryCommon & {
  kind: 'textEntry'
  badge?: boolean
  copyable?: boolean
  url?: string | FieldClosure<string | undefined | Promise<string | undefined>>
  dateTime?: string
  date?: string
  timezone?: string
  since?: boolean
  money?: string
  limit?: number
  markdown?: boolean
}
export type IconEntryDefinition = EntryCommon & {
  kind: 'iconEntry'
  boolean?: boolean
  icons?: Record<string, string>
  colors?: Record<string, string>
}
export type ImageEntryDefinition = EntryCommon & { kind: 'imageEntry'; circular?: boolean }
export type ColorEntryDefinition = EntryCommon & { kind: 'colorEntry' }
export type KeyValueEntryDefinition = EntryCommon & { kind: 'keyValueEntry' }
export type RepeatableEntryDefinition = EntryCommon & {
  kind: 'repeatableEntry'
  schema?: EntryDefinition[]
}
export type CodeEntryDefinition = EntryCommon & { kind: 'codeEntry'; language?: string }
export type BadgeEntryDefinition = EntryCommon & {
  kind: 'badgeEntry'
  colors?: Record<string, string>
}
export type EntryDefinition =
  | TextEntryDefinition
  | IconEntryDefinition
  | ImageEntryDefinition
  | ColorEntryDefinition
  | KeyValueEntryDefinition
  | RepeatableEntryDefinition
  | CodeEntryDefinition
  | BadgeEntryDefinition
export type SchemaNodeDefinition = FieldDefinitionUnion | LayoutDefinition | EntryDefinition
export type SchemaComponent = SchemaNodeBuilder
export type ComponentDefinition = SchemaNodeDefinition
export interface ComponentBuilder<D extends SchemaNodeDefinition> {
  toDefinition(): D
}
export interface FieldBuilderBase<D extends FieldDefinitionUnion> extends ComponentBuilder<D> {
  label(value: string | null | FieldClosure<string | null>): this
  helperText(value: string | null): this
  hint(value: string | null): this
  hintIcon(value: string, options?: { tooltip?: string }): this
  hintColor(value: string): this
  hintAction(value: ActionDefinition | ActionBuilder): this
  placeholder(value: string | null): this
  default(value: unknown | (() => unknown)): this
  required(value?: boolean): this
  nullable(value?: boolean): this
  disabled(value?: boolean | FieldClosure<boolean>): this
  readOnly(value?: boolean): this
  visible(value: FieldClosure<boolean>): this
  hidden(value: FieldClosure<boolean>): this
  columnSpan(value: number | 'full'): this
  extraAttributes(value: Record<string, string>): this
  live(value?: { onBlur?: boolean; debounce?: number; server?: boolean }): this
  afterStateUpdated(value: NonNullable<FieldCommon['afterStateUpdated']>): this
  dehydrated(value?: boolean): this
  dehydratedWhenHidden(value?: boolean): this
  format(value: NonNullable<FieldCommon['format']> | 'hex' | 'rgb' | 'hsl'): this
  dehydrate(value: NonNullable<FieldCommon['dehydrate']>): this
  rules(value: readonly unknown[]): this
}
export interface TextBuilder extends FieldBuilderBase<TextFieldDefinition> {
  prefix(value: string): this
  suffix(value: string): this
  mask(value: string): this
  prefixAction(value: ActionDefinition | ActionBuilder): this
  suffixAction(value: ActionDefinition | ActionBuilder): this
  autocomplete(value: string): this
  datalist(value: readonly string[]): this
  minLength(value: number): this
  maxLength(value: number): this
  regex(value: RegExp | string): this
  alpha(): this
  alphaNumeric(): this
  email(): this
  url(): this
  tel(): this
  telRegex(value: RegExp | string): this
  in(value: readonly unknown[]): this
  same(field: string): this
  different(field: string): this
  confirmed(): this
  unique(value?: NonNullable<ValidationRules['unique']>): this
  exists(value: NonNullable<ValidationRules['exists']>): this
}
export interface PasswordBuilder extends TextBuilder {
  revealable(value?: boolean): this
}
export interface NumberBuilder extends FieldBuilderBase<NumberFieldDefinition> {
  min(value: number): this
  max(value: number): this
  step(value: number): this
  prefix(value: string): this
  suffix(value: string): this
  unique(value?: NonNullable<ValidationRules['unique']>): this
}
export interface SliderBuilder extends FieldBuilderBase<SliderFieldDefinition> {
  min(value: number): this
  max(value: number): this
  step(value: number): this
  marks(value: readonly number[]): this
  range(value?: boolean): this
}
export interface TextareaBuilder extends FieldBuilderBase<TextareaFieldDefinition> {
  rows(value: number): this
  minLength(value: number): this
  maxLength(value: number): this
  autosize(value?: boolean): this
}
export interface SelectBuilder extends FieldBuilderBase<
  Extract<SelectFieldDefinition, { kind: 'select' }>
> {
  options(value: SelectOptions | ((args: SelectOptionsContext) => unknown | Promise<unknown>)): this
  relationship(name: string, titleColumn: string, scope?: RelationshipOptions['scope']): this
  searchable(columns?: readonly string[]): this
  preload(value?: boolean): this
  getOptionLabelUsing(
    callback: NonNullable<Extract<SelectFieldDefinition, { kind: 'select' }>['getOptionLabelUsing']>
  ): this
  createOptionForm(value: readonly SchemaNodeBuilder[]): this
  createOptionUsing(
    callback: NonNullable<Extract<SelectFieldDefinition, { kind: 'select' }>['createOptionUsing']>
  ): this
  prefixAction(value: ActionDefinition | ActionBuilder): this
  suffixAction(value: ActionDefinition | ActionBuilder): this
  clearable(value?: boolean): this
  multiple(value?: boolean): this
  in(value: readonly unknown[]): this
  exists(value: NonNullable<ValidationRules['exists']>): this
}
export interface MultiSelectBuilder extends FieldBuilderBase<
  Extract<SelectFieldDefinition, { kind: 'multiSelect' }>
> {
  options(value: SelectOptions | ((args: SelectOptionsContext) => unknown | Promise<unknown>)): this
  relationship(name: string, titleColumn: string, scope?: RelationshipOptions['scope']): this
  searchable(columns?: readonly string[]): this
  preload(value?: boolean): this
  getOptionLabelUsing(
    callback: NonNullable<
      Extract<SelectFieldDefinition, { kind: 'multiSelect' }>['getOptionLabelUsing']
    >
  ): this
  createOptionForm(value: readonly SchemaNodeBuilder[]): this
  createOptionUsing(
    callback: NonNullable<
      Extract<SelectFieldDefinition, { kind: 'multiSelect' }>['createOptionUsing']
    >
  ): this
  prefixAction(value: ActionDefinition | ActionBuilder): this
  suffixAction(value: ActionDefinition | ActionBuilder): this
  clearable(value?: boolean): this
  in(value: readonly unknown[]): this
  exists(value: NonNullable<ValidationRules['exists']>): this
}
export interface DateBuilder extends FieldBuilderBase<DateFieldDefinition> {
  minDate(value: string): this
  maxDate(value: string): this
  timezone(value: string): this
  seconds(value?: boolean): this
}
export interface RepeaterBuilder extends FieldBuilderBase<RepeaterFieldDefinition> {
  schema(
    value:
      readonly SchemaNodeBuilder[] | ((repeater: SchemaNamespace) => readonly SchemaNodeBuilder[])
  ): this
  minItems(value: number): this
  maxItems(value: number): this
  reorderable(value?: boolean): this
  collapsible(value?: boolean): this
  collapsed(value?: boolean): this
  cloneable(value?: boolean): this
  addLabel(value: string): this
  itemLabel(value: string | FieldClosure<string>): this
  defaultItems(value: number): this
  relationship(name: string, options?: Omit<RepeaterRelationshipOptions, 'name'>): this
  grid(columns: number | Record<string, number>): this
}
export interface FileUploadBuilder extends FieldBuilderBase<FileUploadFieldDefinition> {
  disk(value: string): this
  image(value?: boolean): this
  maxSize(value: number | `${number}kb` | `${number}mb`): this
  multiple(value?: boolean): this
  maxFiles(value: number): this
  accept(value: string | readonly string[]): this
  directory(value: string): this
  visibility(value: 'public' | 'private'): this
  reorderable(value?: boolean): this
  imageEditor(value?: boolean): this
  imageEditorAspectRatios(value: readonly (string | null)[]): this
  downloadable(value?: boolean): this
  previewable(value?: boolean): this
}
export interface RichEditorBuilder extends FieldBuilderBase<RichEditorFieldDefinition> {
  toolbar(value: readonly string[]): this
  minHeight(value: number): this
  maxHeight(value: number): this
  fileAttachmentsDisk(value: string): this
  fileAttachmentsDirectory(value: string): this
}
export interface MarkdownEditorBuilder extends FieldBuilderBase<MarkdownEditorFieldDefinition> {
  toolbar(value: readonly string[]): this
  fileAttachmentsDisk(value: string): this
  fileAttachmentsDirectory(value: string): this
  fileAttachments(options: { disk?: string; directory?: string }): this
}
export interface CodeEditorBuilder extends FieldBuilderBase<CodeEditorFieldDefinition> {
  language(value: NonNullable<CodeEditorFieldDefinition['language']>): this
  lineNumbers(value?: boolean): this
  minHeight(value: number): this
}
export interface CheckboxBuilder extends FieldBuilderBase<CheckboxFieldDefinition> {
  inline(value?: boolean): this
}
export interface CheckboxListBuilder extends FieldBuilderBase<CheckboxListFieldDefinition> {
  options(value: Record<string, unknown> | readonly unknown[]): this
  columns(value: number): this
}
export interface RadioBuilder extends FieldBuilderBase<RadioFieldDefinition> {
  options(value: Record<string, unknown> | readonly unknown[]): this
  descriptions(value: Record<string, string>): this
  inline(value?: boolean): this
}
export interface ToggleBuilder extends FieldBuilderBase<ToggleFieldDefinition> {
  onIcon(value: string): this
  offIcon(value: string): this
  onColor(value: string): this
  offColor(value: string): this
  inline(value?: boolean): this
}
export interface ToggleButtonsBuilder extends FieldBuilderBase<ToggleButtonsFieldDefinition> {
  options(value: Record<string, unknown> | readonly unknown[]): this
  multiple(value?: boolean): this
  grouped(value?: boolean): this
  icons(value: Record<string, string>): this
  colors(value: Record<string, string>): this
}
export interface ColorBuilder extends Omit<FieldBuilderBase<ColorFieldDefinition>, 'format'> {
  presets(value: readonly string[]): this
}
export interface TagsBuilder extends FieldBuilderBase<TagsFieldDefinition> {
  suggestions(value: readonly string[]): this
  separator(value: string): this
  maxTags(value: number): this
  reorderable(value?: boolean): this
}
export interface KeyValueBuilder extends FieldBuilderBase<KeyValueFieldDefinition> {
  keyLabel(value: string): this
  valueLabel(value: string): this
  addable(value?: boolean): this
  deletable(value?: boolean): this
  reorderable(value?: boolean): this
  keyPlaceholder(value: string): this
  valuePlaceholder(value: string): this
}
export interface SimpleFieldBuilder<D extends FieldDefinitionUnion> extends FieldBuilderBase<D> {}
export interface LayoutBase<D extends LayoutDefinition> extends ComponentBuilder<D> {
  visible(value: FieldClosure<boolean>): this
  hidden(value: FieldClosure<boolean>): this
  columnSpan(value: number | 'full'): this
  extraAttributes(value: Record<string, string>): this
}
export interface GridBuilder extends LayoutBase<Extract<LayoutDefinition, { kind: 'grid' }>> {
  components(value: readonly SchemaNodeBuilder[]): this
  columns(value: number | Record<string, number>): this
  gap(value: number): this
}
export interface SectionBuilder extends LayoutBase<Extract<LayoutDefinition, { kind: 'section' }>> {
  components(value: readonly SchemaNodeBuilder[]): this
  heading(value: string): this
  description(value: string): this
  icon(value: string): this
  collapsible(value?: boolean): this
  collapsed(value?: boolean): this
  aside(value?: boolean): this
  compact(value?: boolean): this
  columns(value: number | Record<string, number>): this
}
export interface FieldsetBuilder extends LayoutBase<
  Extract<LayoutDefinition, { kind: 'fieldset' }>
> {
  components(value: readonly SchemaNodeBuilder[]): this
  label(value: string): this
  columns(value: number | Record<string, number>): this
}
export interface ChildrenLayoutBuilder extends LayoutBase<
  Extract<LayoutDefinition, { kind: 'tabs' | 'tab' | 'group' | 'fragment' }>
> {
  components(value: readonly SchemaNodeBuilder[]): this
}
export interface SplitBuilder extends LayoutBase<Extract<LayoutDefinition, { kind: 'split' }>> {
  components(value: readonly SchemaNodeBuilder[]): this
  columns(value: number | Record<string, number>): this
}
export interface PlaceholderBuilder extends LayoutBase<
  Extract<LayoutDefinition, { kind: 'placeholder' }>
> {
  label(value: string): this
  content(value: FieldClosure | string | number | boolean | null): this
}
export interface HtmlBuilder extends LayoutBase<Extract<LayoutDefinition, { kind: 'html' }>> {
  content(value: string | FieldClosure<string>): this
}
export interface ViewBuilder extends LayoutBase<Extract<LayoutDefinition, { kind: 'view' }>> {
  props(value: Record<string, unknown>): this
}
export interface DividerBuilder extends LayoutBase<
  Extract<LayoutDefinition, { kind: 'divider' }>
> {}
export interface TextEntryBuilder extends ComponentBuilder<
  Extract<EntryDefinition, { kind: 'textEntry' }>
> {
  label(value: string | null): this
  badge(value?: boolean): this
  copyable(value?: boolean): this
  url(value: NonNullable<TextEntryDefinition['url']>): this
  dateTime(value?: string): this
  timezone(value: string): this
  date(value?: string): this
  since(value?: boolean): this
  money(currency: string): this
  limit(value: number): this
  markdown(value?: boolean): this
}
export interface IconEntryBuilder extends ComponentBuilder<
  Extract<EntryDefinition, { kind: 'iconEntry' }>
> {
  label(value: string | null): this
  boolean(value?: boolean): this
  icons(value: Record<string, string>): this
  colors(value: Record<string, string>): this
}
export interface ImageEntryBuilder extends ComponentBuilder<
  Extract<EntryDefinition, { kind: 'imageEntry' }>
> {
  label(value: string | null): this
  circular(value?: boolean): this
}
export interface SimpleEntryBuilder<D extends EntryDefinition> extends ComponentBuilder<D> {
  label(value: string | null): this
}
export interface RepeatableEntryBuilder extends SimpleEntryBuilder<
  Extract<EntryDefinition, { kind: 'repeatableEntry' }>
> {
  schema(value: readonly SimpleEntryBuilder<EntryDefinition>[]): this
}
export type EntryBuilder<D extends EntryDefinition> = D extends { kind: 'textEntry' }
  ? TextEntryBuilder
  : D extends { kind: 'iconEntry' }
    ? IconEntryBuilder
    : D extends { kind: 'imageEntry' }
      ? ImageEntryBuilder
      : D extends { kind: 'repeatableEntry' }
        ? RepeatableEntryBuilder
        : SimpleEntryBuilder<D>
export type SchemaNodeBuilder =
  | FieldBuilderBase<FieldDefinitionUnion>
  | TextBuilder
  | PasswordBuilder
  | NumberBuilder
  | SliderBuilder
  | TextareaBuilder
  | SelectBuilder
  | MultiSelectBuilder
  | DateBuilder
  | RepeaterBuilder
  | FileUploadBuilder
  | RichEditorBuilder
  | CheckboxBuilder
  | CheckboxListBuilder
  | RadioBuilder
  | ToggleBuilder
  | ToggleButtonsBuilder
  | ColorBuilder
  | TagsBuilder
  | KeyValueBuilder
  | BuilderBuilder
  | WizardBuilder
  | StepBuilder
  | GridBuilder
  | SectionBuilder
  | FieldsetBuilder
  | ChildrenLayoutBuilder
  | SplitBuilder
  | PlaceholderBuilder
  | HtmlBuilder
  | ViewBuilder
  | DividerBuilder
  | TextEntryBuilder
  | IconEntryBuilder
  | ImageEntryBuilder
  | SimpleEntryBuilder<EntryDefinition>
export type FieldName<M> = [M] extends [never] ? string : keyof M & string
export type FieldConstructors<M> = {
  builder(name: FieldName<M>): BuilderBuilder
  text(name: FieldName<M>): TextBuilder
  email(name: FieldName<M>): TextBuilder
  password(name: FieldName<M>): PasswordBuilder
  number(name: FieldName<M>): NumberBuilder
  slider(name: FieldName<M>): SliderBuilder
  textarea(name: FieldName<M>): TextareaBuilder
  hidden(name: FieldName<M>): SimpleFieldBuilder<HiddenFieldDefinition>
  select(name: FieldName<M>): SelectBuilder
  multiSelect(name: FieldName<M>): MultiSelectBuilder
  checkbox(name: FieldName<M>): CheckboxBuilder
  checkboxList(name: FieldName<M>): CheckboxListBuilder
  radio(name: FieldName<M>): RadioBuilder
  toggle(name: FieldName<M>): ToggleBuilder
  toggleButtons(name: FieldName<M>): ToggleButtonsBuilder
  date(name: FieldName<M>): DateBuilder
  dateTime(name: FieldName<M>): DateBuilder
  time(name: FieldName<M>): DateBuilder
  color(name: FieldName<M>): ColorBuilder
  tags(name: FieldName<M>): TagsBuilder
  keyValue(name: FieldName<M>): KeyValueBuilder
  richEditor(name: FieldName<M>): RichEditorBuilder
  fileUpload(name: FieldName<M>): FileUploadBuilder
  markdownEditor(name: FieldName<M>): MarkdownEditorBuilder
  codeEditor(name: FieldName<M>): CodeEditorBuilder
  repeater(name: string): RepeaterBuilder
  textEntry(name: FieldName<M>): TextEntryBuilder
  iconEntry(name: FieldName<M>): IconEntryBuilder
  imageEntry(name: FieldName<M>): ImageEntryBuilder
  colorEntry(
    name: FieldName<M>
  ): SimpleEntryBuilder<Extract<EntryDefinition, { kind: 'colorEntry' }>>
  keyValueEntry(
    name: FieldName<M>
  ): SimpleEntryBuilder<Extract<EntryDefinition, { kind: 'keyValueEntry' }>>
  repeatableEntry(name: FieldName<M>): RepeatableEntryBuilder
  codeEntry(name: FieldName<M>): SimpleEntryBuilder<Extract<EntryDefinition, { kind: 'codeEntry' }>>
  badgeEntry(
    name: FieldName<M>
  ): SimpleEntryBuilder<Extract<EntryDefinition, { kind: 'badgeEntry' }>>
}
export type FormSchema<M = never> = Omit<
  SchemaNamespace,
  keyof FieldConstructors<M> | 'components' | 'entries'
> &
  FieldConstructors<M> & {
    components(value: readonly SchemaNodeBuilder[]): { components: SchemaNodeDefinition[] }
    entries(value: readonly SchemaNodeBuilder[]): { entries: SchemaNodeDefinition[] }
  }
export type BlockSchemaNamespace = Omit<SchemaNamespace, 'block'>
export type SchemaNamespace = FieldConstructors<never> & {
  grid(): GridBuilder
  section(heading?: string): SectionBuilder
  fieldset(label?: string): FieldsetBuilder
  tabs(tabs?: readonly SchemaNodeBuilder[]): ChildrenLayoutBuilder
  tab(name: string): ChildrenLayoutBuilder
  group(name?: string): ChildrenLayoutBuilder
  split(...children: readonly SchemaNodeBuilder[]): SplitBuilder
  placeholder(name: string): PlaceholderBuilder
  html(content?: string): HtmlBuilder
  divider(): DividerBuilder
  view(component: string, props?: Record<string, unknown>): ViewBuilder
  fragment(children?: readonly SchemaNodeBuilder[]): ChildrenLayoutBuilder
  block(name: string): BuilderBlockBuilder
  wizard(steps?: readonly SchemaNodeBuilder[]): WizardBuilder
  step(name: string): StepBuilder
}
