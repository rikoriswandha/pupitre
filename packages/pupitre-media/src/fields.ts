import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import { defineField, defineEntry, defineColumn } from '@rikology/pupitre'
import { mediaCatalog } from '../catalog.js'
import { resolveMedia } from './service.js'

const methods = { conversion: (conversion: string) => ({ conversion }) }
export const mediaPicker = defineField('mediaPicker', {
  extension: mediaCatalog,
  component: 'MediaPicker',
  methods: {
    ...methods,
    multiple: (multiple = true) => ({ multiple }),
    maxItems: (maxItems: number) => ({ maxItems }),
    accept: (accept: string[]) => ({ accept }),
  },
  validate: (props) =>
    vine.any().use(
      vine.createRule(async (value, _args, field) => {
        const ctx = (field.meta as { ctx?: HttpContext }).ctx
        const ids = props.multiple ? value : [value]
        if (
          !ctx ||
          !Array.isArray(ids) ||
          ids.length > (props.multiple ? props.maxItems : 1) ||
          new Set(ids).size !== ids.length ||
          ids.some((id) => !Number.isSafeInteger(id) || Number(id) <= 0)
        ) {
          field.report('The selected {{ field }} is invalid', 'media', field)
          return
        }
        for (const id of ids) {
          const record = await resolveMedia(ctx, id)
          if (
            !record ||
            !props.accept.some((mime) =>
              mime.endsWith('/*') ? record.mime.startsWith(mime.slice(0, -1)) : record.mime === mime
            )
          ) {
            field.report('The selected {{ field }} is invalid', 'media', field)
            return
          }
        }
      })()
    ),
})
export const mediaEntry = defineEntry('mediaEntry', {
  extension: mediaCatalog,
  component: 'MediaEntry',
  methods,
})
export const mediaColumn = defineColumn('mediaColumn', {
  extension: mediaCatalog,
  component: 'MediaColumn',
  methods,
})
