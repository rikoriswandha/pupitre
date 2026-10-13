import { definePlugin, nav } from '@rikology/pupitre'

export interface PluginOptions {
  documentationUrl?: string
}

export function __camelName__(options: PluginOptions = {}) {
  return definePlugin({
    name: '{{name}}',
    navigation: [
      nav.group('Plugins').items([
        nav
          .item('{{name}} documentation')
          .url(options.documentationUrl ?? 'https://pupitre.rikology.com')
          .external(),
      ]),
    ],
  })
}
