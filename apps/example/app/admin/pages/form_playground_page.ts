import { action, definePage, schema } from '@rikology/pupitre'
import Setting from '#models/setting'

/**
 * Showcase: a custom page form that persists to `settings` (key `playground`).
 * Covers every layout primitive, validation rules, client-lifted reactivity
 * and dehydration controls not already exercised by Products and Orders.
 */

const STORAGE_KEY = 'playground'

const handleHelp = action('handle-help')
  .label('Handle rules')
  .modalHeading('What makes a valid handle?')
  .modalSubmit(false)
  .modalCancelLabel('Got it')
  .form([
    schema.html(
      '<p>Handles are 3–20 letters or digits. They are stored in lowercase, so <code>Rika</code> and <code>rika</code> are the same handle.</p>'
    ),
  ])

export default definePage('form-playground')
  .path('/playground')
  .title('Form playground')
  .icon('sliders-horizontal')
  .navigation({ group: 'Showcase', sort: 3, label: 'Form playground' })
  .canAccess((ctx) => Boolean(ctx.auth.user))
  .form((s) => [
    s
      .section('Account')
      .description('Validation rules, revealable passwords and validate-only fields.')
      .icon('user')
      .components([
        s
          .text('handle')
          .required()
          .alphaNumeric()
          .minLength(3)
          .maxLength(20)
          .prefix('@')
          .autocomplete('username')
          .hint('Stored lowercase')
          .hintColor('info')
          .hintAction(handleHelp)
          // Server-side transformation applied after validation, before save.
          .dehydrate((state) => String(state ?? '').toLowerCase()),
        s.email('email').required().autocomplete('email').different('backupEmail'),
        s.email('backupEmail').label('Backup email').nullable(),
        s
          .password('password')
          .label('New password')
          .minLength(8)
          .revealable()
          .autocomplete('new-password')
          .helperText('Validated, then dropped in save(); never stored by this demo.'),
        s.password('passwordConfirmation').label('Confirm password').same('password').revealable(),
      ]),
    s
      .section('Pricing calculator')
      .description('Arithmetic setters lift to client expressions — no server round trip.')
      .icon('hash')
      .columns(3)
      .components([
        s
          .number('quantity')
          .required()
          .min(1)
          .max(500)
          .default(3)
          .live()
          .afterStateUpdated(({ get, set }) => set('subtotal', get('quantity') * get('unitPrice'))),
        s
          .number('unitPrice')
          .label('Unit price')
          .required()
          .min(0)
          .step(250)
          .prefix('Rp')
          .default(12_500)
          .live()
          .afterStateUpdated(({ get, set }) => set('subtotal', get('quantity') * get('unitPrice'))),
        s.number('subtotal').prefix('Rp').readOnly().dehydrated(false).default(37_500),
        s
          .placeholder('withTax')
          .label('Subtotal incl. 11% VAT')
          // Integer arithmetic keeps the lifted expression free of float noise.
          .content(({ get }) => (get('quantity') * get('unitPrice') * 111) / 100),
        s
          .select('currency')
          .options({ IDR: 'Rupiah', EUR: 'Euro', SGD: 'Singapore dollar' })
          .default('IDR')
          .clearable(),
        s
          .text('couponCode')
          .label('Coupon')
          .datalist(['WELCOME10', 'SPRING24', 'VIP'])
          .regex(/^[A-Z0-9]{3,12}$/)
          .placeholder('WELCOME10'),
      ]),
    s
      .section('Shipping preferences')
      .description('Conditional visibility and disabled state from other fields.')
      .icon('send')
      .collapsible()
      .components([
        s
          .grid()
          .columns({ default: 1, md: 2 })
          .gap(6)
          .components([
            s
              .select('country')
              .options({ id: 'Indonesia', nl: 'Netherlands', sg: 'Singapore' })
              .default('id')
              .required()
              .live(),
            s
              .text('province')
              .label('Province')
              .datalist(['Jawa Barat', 'DKI Jakarta', 'Bali'])
              .visible(({ get }) => get('country') === 'id')
              .dehydratedWhenHidden(false),
            s.checkbox('expressOnly').label('Express couriers only').inline().live(),
            s
              .toggle('signature')
              .label('Require signature')
              .inline()
              .disabled(({ get }) => get('expressOnly') !== true),
            s
              .date('deliverAfter')
              .label('Deliver after')
              .minDate('2026-01-01')
              .maxDate('2027-12-31'),
            s.time('cutoff').label('Daily cutoff').seconds(),
            s.dateTime('pickupAt').label('Pickup (Amsterdam time)').timezone('Europe/Amsterdam'),
            s
              .color('labelColor')
              .presets(['#1f3a5f', '#d97706', '#15803d', '#b91c1c'])
              .label('Parcel label color'),
          ]),
      ]),
    s
      .section('Layout primitives')
      .description('Fieldset, split, group, tabs, divider, HTML and placeholder.')
      .icon('layout-grid')
      .collapsible()
      .collapsed()
      .compact()
      .components([
        s.split(
          s
            .fieldset('Billing')
            .columns(1)
            .components([s.text('billingName').label('Name'), s.text('vatId').label('VAT ID')]),
          s
            .fieldset('Contact')
            .columns(1)
            .components([
              s.text('contactPhone').label('Phone').tel(),
              s.text('website').url().placeholder('https://'),
            ])
        ),
        s.divider(),
        s.tabs([
          s
            .tab('Notes')
            .components([s.textarea('notes').rows(3).autosize().maxLength(500).columnSpan('full')]),
          s.tab('Tags').components([
            s
              .tags('topics')
              .suggestions(['design', 'ops', 'billing'])
              .default(() => []),
          ]),
        ]),
        s.group().components([
          s.html(
            '<p><strong>HTML blocks</strong> are sanitized on the server, so scripts and inline handlers never reach the page.</p>'
          ),
          s
            .placeholder('handlePreview')
            .label('Profile URL preview')
            .content(({ get }) => `https://pupitre.dev/@${get('handle')}`),
        ]),
        s
          .text('internalRef')
          .label('Internal reference')
          .extraAttributes({ 'data-playground': 'internal-ref' })
          .default(() => `REF-${new Date().getUTCFullYear()}`)
          .readOnly(),
      ]),
  ])
  .fill(async () => {
    const setting = await Setting.find(STORAGE_KEY)
    return setting ? (JSON.parse(setting.value) as Record<string, unknown>) : {}
  })
  .save(async ({ data }) => {
    // `.dehydrated(false)` fields skip validation entirely, so validated-but-secret
    // values are stripped here instead.
    const values = Object.fromEntries(
      Object.entries(data).filter(([key]) => key !== 'password' && key !== 'passwordConfirmation')
    )
    await Setting.updateOrCreate({ key: STORAGE_KEY }, { value: JSON.stringify(values) })
  })
  .actions([
    action('reset-playground')
      .label('Reset')
      .icon('rotate-ccw')
      .color('gray')
      .requiresConfirmation()
      .handle(async ({ notify }) => {
        await Setting.query().where('key', STORAGE_KEY).delete()
        notify?.info('Playground reset').send()
      }),
  ])
