import vine from '@vinejs/vine'
import { defineField, definePlugin } from '@rikology/pupitre'
import { catalogNamePlaceholder } from './catalog.js'

export const fieldNamePlaceholder = defineField('{{name}}', {
  extension: catalogNamePlaceholder,
  component: '{{componentName}}',
  methods: {
    stars: (max: number) => ({ max }),
  },
  validate: (props) =>
    vine
      .number()
      .withoutDecimals()
      .min(0)
      .max(props.max ?? 5),
})

export function __camelName__() {
  return definePlugin({
    name: '{{name}}',
    catalog: [catalogNamePlaceholder],
  })
}
