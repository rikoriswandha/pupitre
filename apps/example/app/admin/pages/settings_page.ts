import { action, definePage, t } from '@rikology/pupitre'
import Setting from '#models/setting'

async function readSettings() {
  const rows = await Setting.all()
  return Object.fromEntries(rows.map((setting) => [setting.key, setting.value]))
}

export default definePage('settings')
  .path('/settings')
  .title(t('Settings'))
  .icon('settings')
  .navigation({ group: t('System'), sort: 1, label: t('Settings') })
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
          .options({
            light: t('Light'),
            dark: t('Dark'),
            system: t('System'),
          })
          .required(),
      ]),
  ])
  .fill(async () => {
    const values = await readSettings()
    return {
      siteName: values.siteName ?? 'Pupitre Editorial',
      maintenanceMode: values.maintenanceMode === 'true',
      defaultTheme: values.defaultTheme ?? 'system',
    }
  })
  .save(async ({ data }) => {
    await Setting.updateOrCreate({ key: 'siteName' }, { value: String(data.siteName) })
    await Setting.updateOrCreate(
      { key: 'maintenanceMode' },
      { value: String(Boolean(data.maintenanceMode)) }
    )
    await Setting.updateOrCreate({ key: 'defaultTheme' }, { value: String(data.defaultTheme) })
  })
  .actions([
    action('clear-cache')
      .label(t('Clear cache'))
      .icon('refresh-cw')
      .requiresConfirmation()
      .modalHeading(t('Clear cached settings?'))
      .handle(async ({ notify }) => {
        await Setting.updateOrCreate({ key: '_cache_epoch' }, { value: String(Date.now()) })
        notify?.success(t('Settings cache invalidated')).send()
      }),
  ])
