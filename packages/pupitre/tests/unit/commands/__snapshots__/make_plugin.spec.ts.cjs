exports[`make:plugin writes its stub once and preserves existing files 1`] = `"import { definePlugin, nav } from '@rikology/pupitre'

export default definePlugin({
  name: 'acme-audit',
  navigation: [
    nav.group('Plugins').items([
      nav.item('acme-audit documentation').url('https://pupitre.dev').external(),
    ]),
  ],
})
"`

