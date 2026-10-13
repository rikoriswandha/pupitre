# @rikology/pupitre-settings

Typed grouped settings for Pupitre, with custom pages, JSON values and atomic saves.

```ts
import { defineSettings, settings, settingsFor, saveSettings } from '@rikology/pupitre-settings'
import { definePanel, t } from '@rikology/pupitre'

const general = defineSettings('general')
  .label(t('General'))
  .form((s) => [s.text('siteName').required(), s.toggle('maintenanceMode')])
  .defaults({ siteName: 'Pupitre', maintenanceMode: false })
  .scope('global')

export default definePanel('admin').plugins([
  settings({ groups: [general], authorize: (ctx) => Boolean(ctx.auth.user?.isAdmin) }),
])
const values = await settingsFor(general)
await saveSettings(general, { maintenanceMode: true })
```

Run `node ace add @rikology/pupitre-settings` and `node ace migration:run` before using the plugin. Authorization fails closed unless a callback permits access or host `SettingsPolicy.viewAny(user)` and `SettingsPolicy.manage(user, group)` both permit it. Trusted server APIs do not enforce HTTP authorization. Tenant groups require the resolved active tenant in HTTP, or `{ tenant: { id } }` in commands/jobs. Reads merge defaults; unknown stored keys are ignored and unknown patch keys rejected. Form validation and all changed-key writes run in one transaction.

Values are JSON envelopes with Lucid-managed timestamps. Request-only caching avoids stale cross-process reads. `clearSettingsCache(ctx?)` clears the active request cache. The audit adapter is read-only, so this package does not emit audit events. See the [settings guide](https://pupitre.rikology.com/plugins/settings/) for policy, Shield, tenancy, storage and migration details.

Development: `npm run build`, `npm run quick:test`, `npm run typecheck`. Tests use isolated SQLite by default; `DB=pg DATABASE_URL=postgres://.../pupitre_settings_test npm run quick:test` requires a disposable database with `test` in its name.
