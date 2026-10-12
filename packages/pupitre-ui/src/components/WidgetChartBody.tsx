import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from 'recharts'
import type { WidgetData } from '@rikology/pupitre/catalog'
type Props = { chartType: 'line' | 'bar' | 'area' | 'pie' | 'doughnut'; data?: WidgetData }
export function WidgetChartBody({ chartType, data }: Props) {
  if (!data || data.kind !== 'chart') return <div className="h-64 rounded bg-muted" />
  const rows = data.labels.map((label, index) =>
    Object.fromEntries([
      ['label', label],
      ...data.datasets.map((dataset) => [dataset.label, dataset.data[index] ?? 0]),
    ])
  )
  const first = data.datasets[0]
  const palette = Array.from({ length: 6 }, (_, index) => `var(--chart-${index + 1})`)
  const seriesColors = data.datasets.map(
    (dataset, index) => dataset.color ?? palette[index % palette.length]
  )
  const tooltip = (
    <Tooltip
      contentStyle={{
        background: 'var(--popover)',
        color: 'var(--popover-foreground)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: 'var(--shadow-popover)',
        fontSize: 12,
      }}
      labelStyle={{ color: 'var(--popover-foreground)', fontWeight: 600 }}
      cursor={{ fill: 'var(--muted)', fillOpacity: 0.4 }}
    />
  )
  const legend = (
    <Legend
      iconType="circle"
      iconSize={8}
      wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)', paddingTop: 12 }}
    />
  )
  if (chartType === 'pie' || chartType === 'doughnut') {
    const values = data.labels.map((label, index) => ({
      name: label,
      value: first?.data[index] ?? 0,
    }))
    return (
      <ResponsiveContainer width="100%" height={256}>
        <PieChart>
          <Pie
            data={values}
            dataKey="value"
            nameKey="name"
            innerRadius={chartType === 'doughnut' ? 55 : 0}
            outerRadius={95}
          >
            {values.map((entry, index) => (
              <Cell key={entry.name} fill={first?.color ?? palette[index % palette.length]} />
            ))}
          </Pie>
          {tooltip}
          {legend}
        </PieChart>
      </ResponsiveContainer>
    )
  }
  const Common = (
    <>
      <CartesianGrid stroke="var(--border)" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        axisLine={false}
        tickLine={false}
        tickMargin={10}
      />
      <YAxis
        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        axisLine={false}
        tickLine={false}
        tickMargin={8}
        width={48}
      />
      {tooltip}
      {legend}
    </>
  )
  if (chartType === 'bar')
    return (
      <ResponsiveContainer width="100%" height={256}>
        <BarChart data={rows}>
          {Common}
          {data.datasets.map((dataset, index) => (
            <Bar
              key={dataset.label}
              dataKey={dataset.label}
              fill={seriesColors[index]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  if (chartType === 'area')
    return (
      <ResponsiveContainer width="100%" height={256}>
        <AreaChart data={rows}>
          {Common}
          {data.datasets.map((dataset, index) => (
            <Area
              key={dataset.label}
              type="monotone"
              dataKey={dataset.label}
              stroke={seriesColors[index]}
              fill={seriesColors[index]}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={rows}>
        {Common}
        {data.datasets.map((dataset, index) => (
          <Line
            key={dataset.label}
            type="monotone"
            dataKey={dataset.label}
            stroke={seriesColors[index]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
