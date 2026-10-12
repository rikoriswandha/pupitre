import {
  action,
  actions,
  defineRelationManager,
  defineResource,
  exportColumn,
  pages,
  schema,
  table,
} from '@rikology/pupitre'
import Product from '#models/product'
import ProductPolicy from '#policies/product_policy'
import productInventoryWidget from '#admin/widgets/product_inventory_widget'
import productSalesWidget from '#admin/widgets/product_sales_widget'

/**
 * Showcase: Products. Exercises every input field, every table column kind,
 * every filter kind, the infolist entries, custom row/bulk/header actions and
 * a hasMany relation manager. Read top to bottom as a feature tour.
 */

const STATUS_OPTIONS = { draft: 'Draft', active: 'Active', archived: 'Archived' }
const STATUS_COLORS = { draft: 'gray', active: 'success', archived: 'danger' }
const SHIPPING_OPTIONS = { standard: 'Standard', express: 'Express', freight: 'Freight' }
const SHIPPING_ICONS = { standard: 'send', express: 'trending-up', freight: 'building' }
const SHIPPING_COLORS = { standard: 'gray', express: 'primary', freight: 'warning' }
const MARKET_OPTIONS = {
  id: 'Indonesia',
  sg: 'Singapore',
  my: 'Malaysia',
  nl: 'Netherlands',
  fr: 'France',
  jp: 'Japan',
}
const BRAND_PRESETS = ['#1f3a5f', '#8a5a44', '#0f172a', '#c2a878', '#d97706', '#475569']

const restock = action('restock')
  .label('Restock')
  .icon('plus')
  .group('Inventory')
  .slideOver()
  .modalHeading('Restock product')
  .modalDescription('Adds received units to the on-hand stock count.')
  .modalSubmitLabel('Add stock')
  .form([
    schema.number('quantity').label('Units received').required().min(1).max(1000),
    schema.textarea('note').label('Receiving note').rows(2),
  ])
  .fillForm(({ record }) => ({ quantity: Math.max(10, 50 - (record as Product).stock), note: '' }))
  .handle(async ({ record, data, notify }) => {
    const product = record as Product
    product.stock += Number(data?.quantity ?? 0)
    await product.save()
    notify?.success('Stock updated').body(`${product.name} now has ${product.stock} units.`).send()
  })
  .after(({ refresh }) => {
    refresh.table()
  })

const archive = action('archive')
  .label('Archive')
  .icon('trash-2')
  .color('danger')
  .group('Inventory')
  .can('archive')
  // Confirm-only action (no form): the dialog is titled from the action label.
  .requiresConfirmation()
  .visible(({ record }) => (record as Product).status !== 'archived')
  .handle(async ({ record, notify }) => {
    const product = record as Product
    product.merge({ status: 'archived', isActive: false })
    await product.save()
    notify?.warning('Product archived').body(product.name).send()
  })

const openStorefront = action('storefront')
  .label('Open storefront page')
  .icon('external-link')
  .variant('link')
  .url(({ record }) => `https://pupitre.dev/?product=${(record as Product).slug}`)
  .openUrlInNewTab()

const setStatus = action('set-status')
  .label('Set status')
  .icon('pencil')
  .modalHeading('Change status of selected products')
  .modalWidth('md')
  .form([
    schema
      .radio('status')
      .label('New status')
      .options(STATUS_OPTIONS)
      .descriptions({
        draft: 'Hidden while you prepare the listing.',
        active: 'Sellable on every enabled channel.',
        archived: 'Retired; order history is kept.',
      })
      .required(),
  ])
  .deselectAfter()
  .handle(async ({ records, data, notify }) => {
    const status = String(data?.status) as Product['status']
    for (const product of (records ?? []) as Product[]) {
      product.merge({ status, isActive: status === 'active' })
      await product.save()
    }
    notify?.success(`Updated ${records?.length ?? 0} products`).send()
  })

const archiveSelected = action('archive-selected')
  .label('Archive selected')
  .icon('trash-2')
  .color('danger')
  .can('archive')
  .requiresConfirmation()
  .handle(async ({ records }) => {
    for (const product of (records ?? []) as Product[]) {
      product.merge({ status: 'archived', isActive: false })
      await product.save()
    }
  })

const lowStockReport = action('low-stock-report')
  .label('Low-stock report')
  .icon('trending-down')
  .color('gray')
  .keyBindings(['mod+shift+l'])
  .handle(async ({ ctx, notify }) => {
    const query = Product.query().where('stock', '<', 10).whereNot('status', 'archived')
    if (ctx?.pupitre.tenant) query.where('tenant_id', ctx.pupitre.tenant.id)
    const lowStock = await query.orderBy('stock', 'asc')
    const names = lowStock.map((product) => product.name)
    const notification = names.length
      ? notify?.warning(`${names.length} products need restocking`).body(names.join(', '))
      : notify?.success('Every product is above its reorder point')
    notification?.send()
  })

const variantsManager = defineRelationManager(Product, 'variants')
  .label('Variants')
  .icon('layers')
  .recordTitle('name')
  .badge(async (_ctx, record) => {
    const [row] = await (record as Product).related('variants').query().count('* as total')
    return Number(row?.$extras.total ?? 0)
  })
  .table((t) =>
    t
      .columns([
        table.text('name').label('Variant').sortable().searchable(),
        table.text('sku').label('SKU'),
        table.color('color').label('Swatch'),
        table.text('stock').label('Stock').numeric().sortable().summarize(['sum']),
        table.text('price').label('Price').money('IDR').alignment('end'),
      ])
      .emptyState({
        heading: 'No variants yet',
        description: 'Add a variant to sell sizes or editions separately.',
        icon: 'layers',
      })
  )
  .form((s) => [
    s.text('name').required().maxLength(80),
    s.text('sku').label('SKU').required().maxLength(40),
    s.color('color').presets(BRAND_PRESETS).label('Swatch'),
    s.number('stock').required().min(0).default(0),
    s.number('price').required().min(0).prefix('Rp'),
  ])
  .actions({
    header: [actions.create()],
    row: [actions.edit(), actions.delete()],
    bulk: [actions.delete()],
  })

export default defineResource(Product)
  .slug('products')
  .label('Product')
  .pluralLabel('Products')
  .icon('layers')
  .navigation({ group: 'Showcase', sort: 1 })
  .recordTitle('name')
  .globallySearchable(['name', 'sku'])
  .globalSearchDetails((record) => [record.sku, STATUS_OPTIONS[record.status]])
  .policy(ProductPolicy)
  .mutateBeforeSave((data) => ({ ...data, isActive: data.status === 'active' && data.isActive }))
  .form((s) => [
    s
      .section('Product')
      .description('What shoppers see first.')
      .icon('tag')
      .columns(2)
      .components([
        s
          .text('name')
          .required()
          .maxLength(120)
          // Server watch: slugify is arbitrary JS, so it runs on the server on blur.
          .live({ onBlur: true, server: true })
          .afterStateUpdated(({ get, set, record }) => {
            if (record) return
            set(
              'slug',
              String(get('name') ?? '')
                .toLowerCase()
                .trim()
                .replaceAll(/[^a-z0-9]+/g, '-')
                .replaceAll(/^-|-$/g, '')
            )
          }),
        s
          .text('slug')
          .required()
          .maxLength(140)
          .unique({ ignoreRecord: true })
          .prefix('/shop/')
          .helperText('Filled from the name on create; edit to override.'),
        s
          .text('sku')
          .label('SKU')
          .required()
          .regex(/^[A-Z]{2}-\d{3}$/)
          .placeholder('AC-001')
          .hint('Two letters, a dash, three digits.')
          .hintIcon('circle-help', { tooltip: 'Validated on the server with a regex rule.' }),
        s.select('status').options(STATUS_OPTIONS).default('draft').required().live(),
        s
          .markdownEditor('description')
          .label('Description')
          .toolbar(['bold', 'italic', 'link', 'heading', 'bulletList', 'orderedList'])
          .columnSpan('full'),
      ]),
    s.split(
      s
        .section('Visibility')
        .compact()
        .components([
          s
            .toggle('isActive')
            .label('Live on storefront')
            .onIcon('eye')
            .offIcon('eye-off')
            .onColor('success')
            .helperText('Only active products can go live.')
            .disabled(({ get }) => get('status') !== 'active'),
          s
            .radio('visibility')
            .options({ public: 'Public', unlisted: 'Unlisted', private: 'Private' })
            .descriptions({
              public: 'Listed and searchable.',
              unlisted: 'Reachable by direct link only.',
              private: 'Staff preview only.',
            })
            .default('public')
            .required(),
          s
            .dateTime('launchAt')
            .label('Launch at')
            .visible(({ get }) => get('status') !== 'archived'),
        ]),
      s
        .section('Shipping')
        .compact()
        .collapsible()
        .components([
          s
            .toggleButtons('shippingClass')
            .label('Shipping class')
            .options(SHIPPING_OPTIONS)
            .icons(SHIPPING_ICONS)
            .colors(SHIPPING_COLORS)
            .grouped()
            .default('standard')
            .required(),
          s.color('brandColor').presets(BRAND_PRESETS).label('Brand color'),
        ])
    ),
    s.tabs([
      s.tab('Pricing & inventory').components([
        s.split(
          s.fieldset('Pricing').components([
            s.number('price').required().min(0).step(500).prefix('Rp'),
            s.number('cost').label('Unit cost').min(0).step(500).prefix('Rp'),
            // Arithmetic closures lift to client-side expressions: no round trip.
            s
              .placeholder('margin')
              .label('Margin per unit')
              .content(({ get }) => get('price') - get('cost')),
          ]),
          s
            .fieldset('Inventory')
            .components([
              s.number('stock').required().min(0).suffix('units').default(0),
              s.date('availableFrom').label('Available from'),
              s.time('restockTime').label('Daily restock time'),
            ])
        ),
        // Host React component reading live form state (inertia/admin/views).
        s.view('MarginPreview', { currency: 'IDR', locale: 'id-ID' }).columnSpan('full'),
      ]),
      s.tab('Merchandising').components([
        s
          .checkboxList('sizes')
          .options({ XS: 'XS', S: 'S', M: 'M', L: 'L', XL: 'XL', XXL: 'XXL' })
          .columns(3)
          .default(() => []),
        s
          .tags('labels')
          .label('Labels')
          .suggestions(['bestseller', 'new', 'limited', 'gift', 'eco'])
          .maxTags(5)
          .reorderable()
          .default(() => []),
        s
          .multiSelect('markets')
          .label('Markets')
          .options(MARKET_OPTIONS)
          .searchable()
          .clearable()
          .default(() => ['id']),
        s
          .toggleButtons('channels')
          .label('Sales channels')
          .options({ web: 'Web shop', retail: 'Retail', wholesale: 'Wholesale' })
          .icons({ web: 'globe', retail: 'building', wholesale: 'layers' })
          .multiple()
          .default(() => ['web']),
        s
          .slider('ageRange')
          .label('Recommended age')
          .range()
          .min(0)
          .max(99)
          .marks([0, 18, 65, 99])
          .default(() => [0, 99]),
        s
          .slider('rating')
          .label('Editorial rating')
          .min(0)
          .max(5)
          .step(0.5)
          .marks([0, 1, 2, 3, 4, 5])
          .default(0),
        s
          .keyValue('attributes')
          .label('Attributes')
          .keyLabel('Attribute')
          .valueLabel('Value')
          .keyPlaceholder('material')
          .valuePlaceholder('Recycled paper')
          .reorderable()
          .columnSpan('full')
          .default(() => ({})),
      ]),
      s
        .tab('Media & documents')
        .components([
          s
            .fileUpload('gallery')
            .label('Gallery')
            .disk('uploads')
            .directory('products/gallery')
            .image()
            .multiple()
            .maxFiles(6)
            .reorderable()
            .previewable()
            .maxSize('2mb')
            .accept(['image/png', 'image/jpeg', 'image/webp']),
          s
            .fileUpload('specSheet')
            .label('Spec sheet (PDF)')
            .disk('private')
            .directory('products/specs')
            .visibility('private')
            .downloadable()
            .accept('application/pdf')
            .maxSize('5mb'),
          s
            .codeEditor('specs')
            .label('Technical specs (JSON)')
            .language('json')
            .lineNumbers()
            .minHeight(160),
        ]),
    ]),
  ])
  .table((t) =>
    t
      .columns([
        table.image('gallery').label('Photos').stacked().circular(),
        table
          .text('name')
          .searchable()
          .sortable()
          .description(({ record }) => (record as Product).sku)
          .wrap(),
        table.badge('status').options(STATUS_OPTIONS).colors(STATUS_COLORS).sortable(),
        table.icon('shippingClass').label('Shipping').icons(SHIPPING_ICONS).colors(SHIPPING_COLORS),
        table.color('brandColor').label('Brand').toggleable({ hiddenByDefault: true }),
        table.text('price').money('IDR').sortable().alignment('end').summarize(['avg', 'range']),
        // Editable cells: textInput, select and checkbox PATCH one column with rollback on error.
        table
          .textInput('stock')
          .validation({ required: true, min: 0 })
          .sortable()
          .summarize(['sum'])
          .width('7rem'),
        table
          .select('visibility')
          .options({ public: 'Public', unlisted: 'Unlisted', private: 'Private' })
          .width('9rem'),
        table.checkbox('isActive').label('Live'),
        table
          .text('availableFrom')
          .label('Available')
          .date()
          .sortable()
          .toggleable({ hiddenByDefault: true }),
        table
          .text('launchAt')
          .label('Launched')
          .dateTime()
          .since()
          .toggleable({ hiddenByDefault: true }),
        table.text('rating').numeric().toggleable({ hiddenByDefault: true }),
        table
          .text('slug')
          .url(({ record }) => `https://pupitre.dev/?product=${(record as Product).slug}`)
          .toggleable({ hiddenByDefault: true }),
        t.count('variants'),
      ])
      .filters([
        table.filter.select('status').options(STATUS_OPTIONS).multiple(),
        table.filter.select('shippingClass').options(SHIPPING_OPTIONS),
        table.filter.ternary('isActive').trueLabel('Live').falseLabel('Hidden'),
        table.filter.dateRange('launchAt'),
        table.filter
          .custom('price')
          .form([
            schema.number('min').label('Minimum price').min(0),
            schema.number('max').label('Maximum price').min(0),
          ])
          .query((query, data) => {
            if (data.min !== undefined && data.min !== null && data.min !== '')
              query.where('price', '>=', Number(data.min))
            if (data.max !== undefined && data.max !== null && data.max !== '')
              query.where('price', '<=', Number(data.max))
          }),
      ])
      .filtersLayout('slideover')
      .groups([t.group('shippingClass').label('Shipping class').collapsible()])
      .defaultSort('name', 'asc')
      .paginated([10, 25, 'all'])
      .searchDebounce(200)
      // Row classes are filtered to plain [A-Za-z0-9_-] tokens: no `/opacity` modifiers.
      .rowClass(({ record }) => ((record as Product).stock === 0 ? 'bg-danger-soft' : ''))
      .emptyState({
        heading: 'No products match',
        description: 'Clear filters or add your first product.',
        icon: 'layers',
        action: actions.create(),
      })
  )
  .infolist((s) => [
    s
      .section('Overview')
      .columns(3)
      .components([
        s.textEntry('name'),
        s.textEntry('sku').label('SKU').copyable(),
        s.badgeEntry('status').options(STATUS_OPTIONS).colors(STATUS_COLORS),
        s.textEntry('price').money('IDR'),
        s.textEntry('cost').label('Unit cost').money('IDR'),
        s.textEntry('stock'),
        s.iconEntry('isActive').label('Live').boolean(),
        s
          .iconEntry('shippingClass')
          .label('Shipping')
          .icons(SHIPPING_ICONS)
          .colors(SHIPPING_COLORS),
        s.colorEntry('brandColor').label('Brand color'),
        s.textEntry('availableFrom').label('Available from').date('dd LLL yyyy'),
        s.textEntry('launchAt').label('Launched').since(),
        s
          .textEntry('slug')
          .label('Storefront')
          .url(({ get }) => `https://pupitre.dev/?product=${String(get('slug'))}`),
      ]),
    s
      .section('Description')
      .collapsible()
      .components([s.textEntry('description').label(null).markdown()]),
    s
      .section('Details')
      .columns(2)
      .components([
        s.keyValueEntry('attributes').label('Attributes'),
        s.codeEntry('specs').label('Technical specs'),
        s.textEntry('labels').label('Labels').badge(),
        s.textEntry('markets').label('Markets').badge().options(MARKET_OPTIONS),
      ]),
    s.section('Media').components([s.imageEntry('gallery').label('Gallery')]),
  ])
  .actions({
    header: [
      actions.create(),
      actions.export().columns([
        exportColumn('sku').label('SKU'),
        exportColumn('name').label('Name'),
        exportColumn('price')
          .label('Price (IDR)')
          .formatStateUsing((value) => Number(value ?? 0).toFixed(0)),
        exportColumn('stock').label('Stock'),
      ]),
      lowStockReport,
    ],
    row: [actions.view(), actions.edit(), restock, archive, openStorefront, actions.delete()],
    bulk: [setStatus, archiveSelected, actions.export(), actions.delete()],
  })
  .pages({
    list: pages.list().tabs({
      all: { label: 'All' },
      active: { label: 'Active', where: { status: 'active' } },
      lowStock: { label: 'Low stock', where: (query) => query.where('stock', '<', 10) },
      archived: { label: 'Archived', where: { status: 'archived' } },
    }),
    create: pages.create().redirectTo('edit'),
    edit: pages.edit().widgets([productInventoryWidget]),
    view: pages.view().footerWidgets([productSalesWidget]),
  })
  .relations([variantsManager])
