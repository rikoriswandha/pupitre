import { authorizeResource, mentionProvider, richBlock, scopedQuery } from '@rikology/pupitre'

export const postCallout = richBlock('callout')
  .label('Callout')
  .icon('info')
  .schema((fields) => [
    fields.text('title').label('Callout title').required().maxLength(160),
    fields
      .select('tone')
      .label('Tone')
      .options({ info: 'Information', warning: 'Warning' })
      .required(),
  ])
  .toHtml(
    ({ config }) =>
      `${config.tone === 'warning' ? 'Warning' : 'Information'}: ${String(config.title)}`
  )

export const postMentions = mentionProvider('@').search(async (query, ctx) => {
  const users = ctx.pupitre.panel.resources.find((resource) => resource.slug === 'users')
  if (!users || !ctx.pupitre.tenant || !(await authorizeResource(ctx, users, 'viewAny'))) return []
  const rows = await scopedQuery(ctx, users)
    .join('tenant_user', 'tenant_user.user_id', 'users.id')
    .where('tenant_user.tenant_id', ctx.pupitre.tenant.id)
    .where('users.full_name', 'like', `%${query}%`)
    .select('users.*')
    .limit(20)
  const permitted = []
  for (const row of rows) {
    if (await authorizeResource(ctx, users, 'view', row))
      permitted.push({
        id: row.$getAttribute('id') as number,
        label: String(row.$getAttribute('fullName') ?? row.$getAttribute('email')),
      })
  }
  return permitted
})
