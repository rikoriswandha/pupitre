import { z } from 'zod'
import { defineCatalogExtension } from '@rikology/pupitre/catalog'

const display = z.object({ conversion: z.string().default('thumb') })
export const mediaCatalog = defineCatalogExtension({
  name: 'media',
  components: {
    MediaPicker: {
      kind: 'field',
      description: 'Authorized reusable media selector',
      props: display.extend({
        multiple: z.boolean().default(false),
        maxItems: z.number().int().positive().max(100).default(5),
        accept: z.array(z.string()).default(['image/*']),
      }),
    },
    MediaEntry: { kind: 'entry', description: 'Media thumbnail entry', props: display },
    MediaColumn: { kind: 'column', description: 'Media thumbnail column', props: display },
  },
})
