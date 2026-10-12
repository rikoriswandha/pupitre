import type { FieldCommon, EntryCommon, FieldBuilderBase } from './schema.js'
import type { TableColumnBase } from './table.js'

export type ExtensionMetadata = {
  extension: string
  extensionKind: string
  component: string
  extensionProps: Record<string, unknown>
}
export type ExtensionFieldDefinition = FieldCommon &
  ExtensionMetadata & { kind: 'extensionField'; name: string }
export type ExtensionEntryDefinition = EntryCommon &
  ExtensionMetadata & {
    kind: 'extensionEntry'
    visible?: FieldCommon['visible']
    hidden?: FieldCommon['hidden']
    format?: (value: unknown, record: Record<string, unknown>) => unknown
  }
export type ExtensionColumnDefinition = TableColumnBase &
  ExtensionMetadata & {
    kind: 'custom'
    format?: (value: unknown, record: Record<string, unknown>) => unknown
  }
export type ExtensionMethods = Record<string, (...args: never[]) => Record<string, unknown>>
export type ExtensionFieldBuilder<M extends ExtensionMethods> = {
  [
    K in keyof FieldBuilderBase<ExtensionFieldDefinition>
  ]: FieldBuilderBase<ExtensionFieldDefinition>[K] extends (...args: infer A) => unknown
    ? K extends 'toDefinition'
      ? () => ExtensionFieldDefinition
      : (...args: A) => ExtensionFieldBuilder<M>
    : never
} & { [K in keyof M]: (...args: Parameters<M[K]>) => ExtensionFieldBuilder<M> }
export type ExtensionColumnBuilder<M extends ExtensionMethods> = {
  readonly definition: ExtensionColumnDefinition
  toDefinition(): ExtensionColumnDefinition
  label(value: string): ExtensionColumnBuilder<M>
  sortable(value?: boolean): ExtensionColumnBuilder<M>
  searchable(value?: boolean | { individually?: boolean }): ExtensionColumnBuilder<M>
  toggleable(value?: { hiddenByDefault?: boolean }): ExtensionColumnBuilder<M>
  alignment(value: 'start' | 'center' | 'end'): ExtensionColumnBuilder<M>
  width(value: string): ExtensionColumnBuilder<M>
} & { [K in keyof M]: (...args: Parameters<M[K]>) => ExtensionColumnBuilder<M> }
export type ExtensionEntryBuilder<M extends ExtensionMethods> = {
  toDefinition(): ExtensionEntryDefinition
  label(value: string | null): ExtensionEntryBuilder<M>
  visible(value: NonNullable<FieldCommon['visible']>): ExtensionEntryBuilder<M>
  hidden(value: NonNullable<FieldCommon['hidden']>): ExtensionEntryBuilder<M>
  columnSpan(value: number | 'full'): ExtensionEntryBuilder<M>
} & { [K in keyof M]: (...args: Parameters<M[K]>) => ExtensionEntryBuilder<M> }
