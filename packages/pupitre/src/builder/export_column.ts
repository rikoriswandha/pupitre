import type { ExportColumnBuilder, ExportColumnDefinition } from '../definition/action.js'
export type { ExportColumnBuilder, ExportColumnDefinition } from '../definition/action.js'

class ExportColumn implements ExportColumnBuilder {
  constructor(readonly definition: ExportColumnDefinition) {}
  private set(patch: Partial<ExportColumnDefinition>): this {
    return new ExportColumn({ ...this.definition, ...patch }) as this
  }
  label(value: string): this {
    return this.set({ label: value })
  }

  formatStateUsing(formatter: NonNullable<ExportColumnDefinition['formatStateUsing']>): this {
    return this.set({ formatStateUsing: formatter })
  }
}

export function exportColumn(name: string): ExportColumnBuilder {
  return new ExportColumn({ name })
}
