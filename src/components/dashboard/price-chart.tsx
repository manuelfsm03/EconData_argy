"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { format } from "date-fns"

interface DataPoint {
  date: string | Date
  [key: string]: unknown
}

interface Series {
  key: string
  name: string
  color: string
}

interface PriceChartProps {
  data: DataPoint[]
  series: Series[]
  title: string
  subtitle?: string
  height?: number
}

export function PriceChart({ data, series, title, height = 250 }: PriceChartProps) {
  const formattedData = data.map((d) => ({
    ...d,
    date: typeof d.date === "string" ? d.date : format(d.date, "dd/MM"),
  }))

  return (
    <div className="bbg-panel">
      <div className="bbg-panel-header">{title}</div>
      <div style={{ padding: "4px 0" }}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={formattedData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#1a1a1a" />
            <XAxis
              dataKey="date"
              stroke="#555555"
              fontSize={9}
              tickLine={false}
              axisLine={{ stroke: "#333333" }}
            />
            <YAxis
              stroke="#555555"
              fontSize={9}
              tickLine={false}
              axisLine={{ stroke: "#333333" }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0a0a0a",
                border: "1px solid #333333",
                borderRadius: "0",
                fontSize: "10px",
                fontFamily: "inherit",
              }}
              labelStyle={{ color: "#FFA028" }}
              itemStyle={{ padding: 0 }}
            />
            <Legend
              wrapperStyle={{ fontSize: "10px", paddingTop: "4px" }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: s.color }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
