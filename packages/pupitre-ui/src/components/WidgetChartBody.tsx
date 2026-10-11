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
  const palette = ['#2563eb', '#db2777', '#16a34a', '#ea580c', '#7c3aed', '#0891b2']
  const seriesColors = data.datasets.map(
    (dataset, index) => dataset.color ?? palette[index] ?? `hsl(${(index * 137.508) % 360} 65% 52%)`
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
              <Cell
                key={entry.name}
                fill={palette[index] ?? `hsl(${(index * 137.508) % 360} 65% 52%)`}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }
  const Common = (
    <>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="label" />
      <YAxis />
      <Tooltip />
      <Legend />
    </>
  )
  if (chartType === 'bar')
    return (
      <ResponsiveContainer width="100%" height={256}>
        <BarChart data={rows}>
          {Common}
          {data.datasets.map((dataset, index) => (
            <Bar key={dataset.label} dataKey={dataset.label} fill={seriesColors[index]} />
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
              fillOpacity={0.2}
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
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
