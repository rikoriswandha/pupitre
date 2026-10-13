import { useState } from 'react'
import { ConfirmDialog } from '../../../src/components/ConfirmDialog.js'
export function XlsxPickerStory() {
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv')
  const [submitted, setSubmitted] = useState('')
  return (
    <>
      <ConfirmDialog
        open
        heading="Export"
        exportFormats={['csv', 'xlsx']}
        exportFormat={format}
        onExportFormatChange={setFormat}
        submitLabel="Export"
        onConfirm={() => setSubmitted(format)}
        onCancel={() => {}}
      />
      <output data-testid="submitted">{submitted}</output>
    </>
  )
}
