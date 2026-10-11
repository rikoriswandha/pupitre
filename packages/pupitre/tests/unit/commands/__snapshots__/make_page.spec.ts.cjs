exports[`unit / make:page writes its stub once and preserves existing files 1`] = `import { definePage } from '@rikology/pupitre'

export default definePage('settings')
  .path('/settings')
  .title("Settings")
  .form(() => [])
`

exports[`make:page writes its stub once and preserves existing files 1`] = `"import { definePage } from '@rikology/pupitre'

export default definePage('settings')
  .path('/settings')
  .title(\\"Settings\\")
  .form(() => [])
"`

