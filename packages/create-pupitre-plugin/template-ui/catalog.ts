import { z } from 'zod'
import { defineCatalogExtension } from '@rikology/pupitre/catalog'

export const catalogNamePlaceholder = defineCatalogExtension({
  name: '{{name}}',
  components: {
    __componentName__: {
      kind: 'field',
      props: z.object({
        name: z.string().optional(),
        label: z.string().optional(),
        value: z.number().nullable().optional(),
        max: z.number().int().positive().default(5),
        required: z.boolean().optional(),
        disabled: z.boolean().optional(),
        readOnly: z.boolean().optional(),
        helperText: z.string().optional(),
        error: z.string().optional(),
      }),
      description: 'An integer rating field with configurable maximum.',
    },
  },
})
