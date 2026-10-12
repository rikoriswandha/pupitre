import { t } from '@rikology/pupitre'
import { defineSettings } from '@rikology/pupitre-settings'

export const generalSettings = defineSettings('general')
  .label(t('Settings'))
  .sort(1)
  .form((s) => [
    s
      .section(t('General'))
      .columns(2)
      .components([
        s.text('siteName').label(t('Site name')).required().maxLength(120),
        s.toggle('maintenanceMode').label(t('Maintenance mode')),
        s
          .select('defaultTheme')
          .label(t('Default theme'))
          .options({ light: t('Light'), dark: t('Dark'), system: t('System') })
          .required(),
        s
          .codeEditor('editorConfig')
          .label(t('Editor configuration'))
          .language('json')
          .lineNumbers()
          .minHeight(180),
      ]),
  ])
  .defaults({
    siteName: 'Pupitre Editorial',
    maintenanceMode: false,
    defaultTheme: 'system',
    editorConfig: '{\n  "format": "markdown"\n}',
  })

export const tenantSettings = defineSettings('workspace')
  .label(t('Workspace settings'))
  .sort(2)
  .scope('tenant')
  .form((s) => [
    s.text('workspaceName').label(t('Workspace name')).required().maxLength(120),
    s.toggle('acceptSubmissions').label(t('Accept submissions')),
  ])
  .defaults({ workspaceName: 'Editorial workspace', acceptSubmissions: true })
