import { action, definePage } from '@rikology/pupitre'
import storeKpis from '../widgets/store_kpis_widget.js'
import storeRevenue from '../widgets/store_revenue_widget.js'
import storeOrdersByWeek from '../widgets/store_orders_by_week_widget.js'
import storeStatus from '../widgets/store_status_widget.js'
import storePayments from '../widgets/store_payments_widget.js'
import storeLowStock from '../widgets/store_low_stock_widget.js'
import storeActivity from '../widgets/store_activity_widget.js'
import storeTips from '../widgets/store_tips_widget.js'
import storeRadar from '../widgets/store_radar_widget.js'
import storeScatter from '../widgets/store_scatter_widget.js'
import currenciesWidget from '../widgets/currencies_widget.js'

/**
 * Showcase: a custom dashboard page with every widget kind (stats, line, area,
 * pie, doughnut, table, timeline, host component) and a URL-backed filter.
 */
export default definePage('store-overview')
  .path('/store')
  .title('Store overview')
  .icon('chart-column')
  .navigation({ group: 'Showcase', sort: 0, label: 'Store overview' })
  .widgets([
    storeKpis,
    storeRevenue,
    storeOrdersByWeek,
    storeStatus,
    storePayments,
    storeRadar,
    storeScatter,
    storeLowStock,
    storeActivity,
    storeTips,
    currenciesWidget,
  ])
  .filters([
    {
      name: 'channel',
      label: 'Sales channel',
      options: [
        { value: 'web', label: 'Web shop' },
        { value: 'retail', label: 'Retail' },
        { value: 'wholesale', label: 'Wholesale' },
      ],
    },
  ])
  .actions([
    action('open-orders')
      .label('Open orders')
      .icon('inbox')
      // `panel.path` is already tenant-scoped (e.g. /admin/acme).
      .url(({ ctx }) => `${ctx?.pupitre.panel.path}/orders`),
  ])
