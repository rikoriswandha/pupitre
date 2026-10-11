exports[`make:widget writes a typed stub once and preserves existing files 1`] = `"import { defineWidget } from '@rikology/pupitre'

export default defineWidget('posts-per-month')
  .chart('line', () => ({ labels: [], datasets: [] }))
"`

exports[`make:widget table stub imports a model and compiles as a widget definition 1`] = `"import { defineWidget } from '@rikology/pupitre'
import Model from \\"#models/posts\\"
export default defineWidget('posts', Model)
  .table((table) => table)
"`

