import { action, actions, defineResource, pages, schema, table } from '@rikology/pupitre'
import { DateTime } from 'luxon'
import Post from '#models/post'
import PostPolicy from '#policies/post_policy'

const manageCategories = action('manage-categories')
  .label('Manage categories')
  .url(({ ctx }) => `${ctx?.pupitre.panel.path}/categories`)
const publish = action('publish')
  .label('Publish')
  .color('success')
  .can('publish')
  .modalHeading('Publish post')
  .modalSubmitLabel('Publish')
  .form([
    schema.dateTime('publishedAt').label('Publish at').required(),
    schema.checkbox('notify').label('Notify subscribers'),
  ])
  .fillForm(({ record }) => ({
    publishedAt: (record as Post).publishedAt?.toISO() ?? DateTime.now().toISO(),
    notify: false,
  }))
  .handle(async ({ record, data, notify }) => {
    const post = record as Post
    await Post.transaction(async (trx) => {
      post.useTransaction(trx)
      post.status = 'published'
      post.publishedAt = DateTime.fromISO(String(data?.publishedAt ?? DateTime.now().toISO()), {
        setZone: true,
      }).toUTC()
      await post.save()
    })
    const notification = notify?.success('Post published').body(post.title)
    notification?.send()
    await notification?.sendToDatabase()
  })
  .after(({ refresh }) => {
    refresh.table()
  })

export default defineResource(Post)
  .slug('posts')
  .label('Post')
  .pluralLabel('Posts')
  .icon('file-text')
  .navigation({ group: 'Content', sort: 1 })
  .recordTitle('title')
  .globallySearchable(['title', 'slug', 'category.name'])
  .globalSearchDetails((record) =>
    [record.category?.name, record.status].filter((detail): detail is string => Boolean(detail))
  )
  .policy(PostPolicy)
  .fill((record) => ({ ...record.serialize() }))
  .mutateBeforeCreate((data, ctx) => ({
    ...data,
    categoryId: Number(data.categoryId),
    authorId: ctx.auth.user!.id,
  }))
  .form((s) => [
    s
      .section('Post details')
      .columns(2)
      .components([
        s
          .text('title')
          .required()
          .maxLength(200)
          .live()
          .afterStateUpdated(({ set, get }) => set('slug', get('title'))),
        s.text('slug').required().maxLength(220).unique({ ignoreRecord: true }),
        s
          .select('status')
          .label('Status')
          .options(async ({ search }) =>
            ['draft', 'published']
              .filter((status) => status.includes(search.toLowerCase()))
              .map((status) => ({
                value: status,
                label: status === 'draft' ? 'Draft' : 'Published',
              }))
          )
          .searchable()
          .default('draft')
          .live(),
        s
          .dateTime('publishedAt')
          .label('Published at')
          .timezone('Asia/Jakarta')
          .visible(({ get }) => get('status') === 'published'),
        s
          .select('categoryId')
          .label('Category')
          .relationship('category', 'name')
          .searchable()
          .createOptionForm([
            schema.text('name').label('Name').required(),
            schema.text('slug').label('Slug').required(),
          ])
          .suffixAction(manageCategories)
          .required(),
        s.checkbox('isFeatured').label('Featured'),
        s.number('viewsCount').label('Views').min(0).default(0),
      ]),
    s.tabs([
      s.tab('Content').components([
        s
          .richEditor('body')
          .label('Body')
          .toolbar(['bold', 'italic', 'link', 'bulletList', 'orderedList'])
          .columnSpan('full'),
        s
          .repeater('items')
          .label('Items')
          .schema([
            schema.text('sku').label('SKU').required(),
            schema.number('qty').label('Quantity').required().min(1),
            schema.number('price').label('Price').required().min(0),
            schema
              .placeholder('subtotal')
              .label('Subtotal')
              .content(({ get }: { get(path: string): number }) => get('qty') * get('price')),
          ])
          .defaultItems(0)
          .addLabel('Add item'),
      ]),
      s
        .tab('Media')
        .components([
          s
            .fileUpload('cover')
            .label('Cover image')
            .disk('uploads')
            .image()
            .maxSize('2mb')
            .accept(['image/png', 'image/jpeg', 'image/webp']),
        ]),
    ]),
  ])
  .table((t) =>
    t
      .columns([
        table
          .text('title')
          .searchable()
          .sortable()
          .description(({ record }) => (record as Post).slug),
        table.text('category.name').label('Category').sortable(),
        table.badge('status').colors({ draft: 'gray', published: 'success' }),
        table.image('cover').circular(),
        table.icon('isFeatured').boolean().icons({ true: 'star', false: 'minus' }),
        table.text('publishedAt').label('Published').dateTime().since(),
        table.text('viewsCount').label('Views').numeric(),
      ])
      .filters([
        table.filter.select('status').options({ draft: 'Draft', published: 'Published' }),
        table.filter.ternary('isFeatured').trueLabel('Featured').falseLabel('Not featured'),
        table.filter.dateRange('publishedAt'),
      ])
      .defaultSort('title', 'asc')
  )
  .infolist((s) => [
    s.textEntry('title').label('Title'),
    s.textEntry('slug').label('Slug').copyable(),
    s.badgeEntry('status').label('Status'),
    s.textEntry('publishedAt').label('Published').dateTime('yyyy LLL dd, HH:mm'),
    s.textEntry('viewsCount').label('Views'),
    s.imageEntry('cover').label('Cover').circular(),
    s
      .repeatableEntry('items')
      .label('Items')
      .schema([
        s.textEntry('sku').label('SKU'),
        s.textEntry('qty').label('Quantity'),
        s.textEntry('price').label('Price').money('IDR'),
      ]),
    s.html().content(({ get }) => String(get('body') ?? '')),
  ])
  .actions({
    header: [actions.create(), manageCategories],
    row: [actions.edit(), actions.view(), publish],
    bulk: [actions.delete()],
  })
  .pages({
    list: pages.list().tabs({
      all: { label: 'All' },
      draft: { label: 'Draft', where: { status: 'draft' } },
      published: { label: 'Published', where: { status: 'published' } },
    }),
    create: pages.create().redirectTo('edit'),
    edit: pages.edit(),
    view: pages.view(),
  })
