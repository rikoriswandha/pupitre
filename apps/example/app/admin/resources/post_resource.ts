import {
  action,
  actions,
  defineResource,
  exportColumn,
  notificationAction,
  pages,
  schema,
  table,
} from '@rikology/pupitre'
import { DateTime } from 'luxon'
import Post, { POST_STATUS_COLORS, POST_STATUS_OPTIONS } from '#models/post'
import PostPolicy from '#policies/post_policy'
import { defineRelationManager, relationGroup } from '@rikology/pupitre'
import RevisionResource from '#admin/resources/revision_resource'
import postEditSummaryWidget from '#admin/widgets/post_edit_summary_widget'

const manageCategories = action('manage-categories')
  .label('Manage categories')
  .url(({ ctx }) => `${ctx?.pupitre.panel.path}/categories`)
const publishNotice = action('publish-notice')
  .label('Send a preview notification')
  .handle(({ data, notify }) => {
    notify?.info(`Preview: ${String(data?.publishedAt ?? 'not scheduled')}`).send()
  })
const publishingHelp = action('publishing-help')
  .label('Publication help')
  .modalHeading('Publishing')
  .modalSubmit(false)
  .form([
    schema.placeholder('help').content('Publish schedules the post and notifies subscribers.'),
  ])
const publish = action('publish')
  .label('Publish')
  .color('success')
  .can('publish')
  .deepLinkable()
  .modal({ footerActions: [publishNotice] })
  .modalHeading('Publish post')
  .modalSubmitLabel('Publish')
  .form([
    schema
      .wizard([
        schema
          .step('Schedule')
          .components([schema.dateTime('publishedAt').label('Publish at').required()]),
        schema.step('Notify').components([schema.checkbox('notify').label('Notify subscribers')]),
      ])
      .submitLabel('Publish post'),
  ])
  .fillForm(({ record }) => ({
    publishedAt: (record as Post).publishedAt?.toISO() ?? DateTime.now().toISO(),
    notify: false,
  }))
  .handle(async ({ record, data, notify, ctx }) => {
    const post = record as Post
    await Post.transaction(async (trx) => {
      post.useTransaction(trx)
      post.status = 'published'
      post.publishedAt = DateTime.fromISO(String(data?.publishedAt ?? DateTime.now().toISO()), {
        setZone: true,
      }).toUTC()
      await post.save()
    })
    const tenantPath = ctx?.pupitre.tenant?.slug ? `/${ctx.pupitre.tenant.slug}` : ''
    const notification = notify
      ?.success('Post published')
      .body(post.title)
      .actions([
        notificationAction('View post')
          .url(`${ctx?.pupitre.panel.path}${tenantPath}/posts/${post.id}`)
          .markAsRead(),
        notificationAction('Mark read').markAsRead(),
      ])
    notification?.send()
    await notification?.sendToDatabase()
  })
  .after(({ refresh }) => {
    refresh.table()
  })
const rateLimited = action('rate-limited')
  .label('Rate limited')
  .can('publish')
  .rateLimit(2, { per: '1 minute', by: 'user' })
  .handle(({ notify }) => {
    notify?.success('Rate-limited action ran').send()
  })

function slugifyPostTitle(title: unknown): string {
  return String(title ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
const commentsManager = defineRelationManager(Post, 'comments')
  .label('Comments')
  .icon('message-square')
  .recordTitle('title')
  .table((t) =>
    t.columns([
      table.text('title').label('Title').sortable().searchable(),
      table.text('body').label('Comment').limit(90),
    ])
  )
  .form((s) => [s.text('title').required(), s.textarea('body').required().rows(3)])
  .actions({
    header: [actions.create(), actions.associate()],
    row: [actions.edit(), actions.delete(), actions.dissociate()],
    bulk: [actions.bulkDissociate()],
  })

const tagsManager = defineRelationManager(Post, 'tags')
  .label('Tags')
  .icon('tags')
  .recordTitle('name')
  .table((t) =>
    t.columns([
      table.text('name').label('Tag').sortable().searchable(),
      table.text('slug').label('Slug'),
    ])
  )
  .form((s) => [s.text('note').label('Relationship note')])
  .actions({
    header: [actions.attach()],
    row: [actions.detach()],
    bulk: [actions.bulkDetach()],
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
  .softDeletes('deletedAt')
  .fill((record) => ({ ...record.serialize() }))
  .mutateBeforeCreate((data, ctx) => ({
    ...data,
    categoryId: Number(data.categoryId),
    authorId: ctx.auth.user!.id,
  }))
  .mutateBeforeSave((data) => ({ ...data, excerpt: data.excerpt ?? '' }))
  .form((s) => [
    s
      .wizard([
        s.step('Content blocks').components([
          s
            .builder('content')
            .label('Content blocks')
            .blocks([
              schema
                .block('heading')
                .label('Heading')
                .icon('heading')
                .schema([schema.text('text').label('Heading text').required()]),
              schema
                .block('paragraph')
                .label('Paragraph')
                .icon('align-left')
                .schema([schema.textarea('text').label('Paragraph text').required().rows(4)]),
            ])
            .minItems(0)
            .maxItems(20)
            .reorderable()
            .collapsible()
            .cloneable()
            .addLabel('Add block')
            .blockPickerColumns(2),
        ]),
        s
          .step('Review')
          .description('Save the post when all content blocks are ready.')
          .components([
            s
              .placeholder('contentReview')
              .content('Your block order and text will be saved with this post.'),
          ]),
      ])
      .startOnStep(1)
      .submitLabel('Save post'),
    s
      .section('Post details')
      .columns(2)
      .components([
        s
          .text('title')
          .required()
          .maxLength(200)
          .live({ server: true, debounce: 250 })
          .afterStateUpdated(({ set, get }) => set('slug', slugifyPostTitle(get('title')))),
        s
          .text('slug')
          .required()
          .maxLength(220)
          .unique({ ignoreRecord: true })
          .hint('Used in public post URLs.')
          .hintIcon('circle-help', { tooltip: 'Use lowercase words separated by hyphens.' })
          .hintAction(manageCategories)
          .prefixAction(manageCategories),
        s
          .select('status')
          .label('Status')
          .options(async ({ search }) =>
            Object.entries(POST_STATUS_OPTIONS)
              .filter(([status]) => status.includes(search.toLowerCase()))
              .map(([value, label]) => ({ value, label }))
          )
          .searchable()
          .default('draft')
          .live(),
        s
          .dateTime('publishedAt')
          .label('Published at')
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
        s
          .text('contactPhone')
          .label('Phone')
          .tel()
          .telRegex(/^\d{10}$/)
          .mask('(999) 999-9999'),
        s.text('website').label('Website').url(),
        s.slider('priority').label('Priority').min(0).max(100).step(5).marks([0, 50, 100]),
      ]),
    s.tabs([
      s.tab('Content').components([
        s.textarea('excerpt').label('Excerpt').rows(2).autosize().columnSpan('full').default(''),
        s
          .markdownEditor('summary')
          .label('Summary')
          .toolbar(['bold', 'italic', 'link', 'heading', 'bulletList', 'orderedList', 'code'])
          .columnSpan('full'),
        s
          .richEditor('body')
          .label('Body')
          .toolbar(['bold', 'italic', 'link', 'bulletList', 'orderedList'])
          .fileAttachmentsDisk('uploads')
          .fileAttachmentsDirectory('posts/body')
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
        s
          .repeater('links')
          .label('Related links')
          .schema([
            schema.text('label').label('Label').required(),
            schema.text('url').label('URL').url().required(),
          ])
          .relationship('links', { orderColumn: 'sort' })
          .defaultItems(0)
          .addLabel('Add related link'),
      ]),
      s
        .tab('Media')
        .components([
          s
            .fileUpload('cover')
            .label('Cover image')
            .disk('uploads')
            .image()
            .imageEditor()
            .imageEditorAspectRatios(['16:9', '4:3', '1:1', null])
            .maxSize('2mb')
            .accept(['image/png', 'image/jpeg', 'image/webp']),
        ]),
    ]),
  ])
  .table((t) =>
    t
      .columns([
        table
          .textInput('title')
          .validation({ required: true, maxLength: 200 })
          .sortable()
          .searchable(),
        table.text('category.name').label('Category').sortable(),
        table.select('status').options(POST_STATUS_OPTIONS),
        table.image('cover').circular(),
        table.toggle('isFeatured'),
        table
          .text('publishedAt')
          .label('Published')
          .dateTime()
          .timezone('Europe/Amsterdam')
          .since(),
        table
          .text('viewsCount')
          .label('Views')
          .numeric()
          .searchable({ individually: true })
          .summarize(['sum', 'avg', 'count', 'range'])
          .toggleable({ hiddenByDefault: true }),
        t.count('comments'),
      ])
      .filters([
        table.filter.select('status').options(POST_STATUS_OPTIONS),
        table.filter.ternary('isFeatured').trueLabel('Featured').falseLabel('Not featured'),
        table.filter.dateRange('publishedAt'),
        table.filter.trashed(),
      ])
      .defaultSort('title', 'asc')
      .groups([t.group('status').label('Post status').collapsible()])
      .poll('30s')
      .deferFilters()
      .rowClass(({ record }) => ((record as Post).status === 'draft' ? 'bg-warning-soft/50' : ''))
  )
  .infolist((s) => [
    s.textEntry('title').label('Title'),
    s.textEntry('summary').label('Summary').markdown(),
    s.textEntry('slug').label('Slug').copyable(),
    s.badgeEntry('status').label('Status').options(POST_STATUS_OPTIONS).colors(POST_STATUS_COLORS),
    s.textEntry('publishedAt').label('Published').dateTime('yyyy LLL dd, HH:mm'),
    s.textEntry('viewsCount').label('Views'),
    s.textEntry('content').label('Content blocks'),
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
    header: [
      actions.create(),
      actions.export().columns([
        exportColumn('title')
          .label('Title')
          .formatStateUsing((value) => String(value ?? '').toUpperCase()),
        exportColumn('slug').label('Slug'),
      ]),
      actions.import().resolveRecord(({ data }) => Post.findBy('slug', String(data.slug))),
      manageCategories,
    ],
    row: [
      actions.edit(),
      actions.delete(),
      actions.view(),
      actions.replicate().excludeAttributes(['slug']),
      actions.restore().visible(({ record }) => Boolean((record as Post).deletedAt)),
      actions.forceDelete().visible(({ record }) => Boolean((record as Post).deletedAt)),
      publish,
      rateLimited,
      publishingHelp,
    ],
    bulk: [actions.delete(), actions.export(), actions.bulkRestore(), actions.bulkForceDelete()],
  })
  .pages({
    list: pages.list().tabs({
      all: { label: 'All' },
      draft: { label: 'Draft', where: { status: 'draft' } },
      published: { label: 'Published', where: { status: 'published' } },
    }),
    create: pages.create().redirectTo('edit'),
    edit: pages.edit().widgets([postEditSummaryWidget]),
    view: pages.view(),
  })
  .relations([relationGroup('Content', [commentsManager, tagsManager])])
  .nested([RevisionResource])
