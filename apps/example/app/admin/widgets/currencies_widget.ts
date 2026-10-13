import { action, defineWidget, schema, table, t } from '@rikology/pupitre'

const currencies = [
  { id: 'IDR', name: 'Indonesian rupiah', region: 'Asia', decimals: 0 },
  { id: 'JPY', name: 'Japanese yen', region: 'Asia', decimals: 0 },
  { id: 'SGD', name: 'Singapore dollar', region: 'Asia', decimals: 2 },
  { id: 'USD', name: 'US dollar', region: 'Americas', decimals: 2 },
  { id: 'CAD', name: 'Canadian dollar', region: 'Americas', decimals: 2 },
  { id: 'BRL', name: 'Brazilian real', region: 'Americas', decimals: 2 },
  { id: 'EUR', name: 'Euro', region: 'Europe', decimals: 2 },
  { id: 'GBP', name: 'Pound sterling', region: 'Europe', decimals: 2 },
]

/** HTTP-free custom rows; the URL remains the sole source of table state. */
export default defineWidget('currencies')
  .heading(t('Currencies'))
  .span('full')
  .lazy(false)
  .table((builder) =>
    builder
      .columns([
        table.text('id').label(t('Code')).sortable(),
        table.text('name').searchable().sortable(),
        table.text('region'),
        table.text('decimals').numeric(),
      ])
      .filters([
        table.filter
          .select('region')
          .options({ Asia: t('Asia'), Americas: t('Americas'), Europe: t('Europe') }),
      ])
      .paginated([3, 6])
      .records(({ search, filters, sort, page, perPage }) => {
        const rows = currencies.filter(
          (row) =>
            row.name.toLowerCase().includes(search.toLowerCase()) &&
            (!filters.region || row.region === filters.region)
        )
        for (const order of [...sort].reverse())
          rows.sort(
            (left, right) =>
              String(Reflect.get(left, order.column)).localeCompare(
                String(Reflect.get(right, order.column))
              ) * (order.direction === 'desc' ? -1 : 1)
          )
        const size = perPage === 'all' ? rows.length : perPage
        return { rows: rows.slice((page - 1) * size, page * size), total: rows.length }
      })
      .resolveRecord((key) => currencies.find((row) => row.id === key) ?? null)
      .actions({
        row: [
          action('inspect-currency')
            .label(t('Inspect'))
            .modalHeading(t('Currency details'))
            .modalSubmit(false)
            .form([schema.text('name').readOnly(), schema.text('region').readOnly()])
            .fillForm(({ record }) =>
              record && typeof record === 'object'
                ? { name: Reflect.get(record, 'name'), region: Reflect.get(record, 'region') }
                : {}
            ),
        ],
      })
  )
