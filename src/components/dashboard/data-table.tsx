"use client"

import { cn } from "@/lib/utils"

interface Column<T> {
  key: keyof T | string
  header: string
  render?: (value: unknown, row: T) => React.ReactNode
  className?: string
  numeric?: boolean
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  className?: string
  title?: string
}

export function DataTable<T extends object>({
  data,
  columns,
  className,
  title,
}: DataTableProps<T>) {
  return (
    <div className={cn("bbg-panel", className)}>
      {title && <div className="bbg-panel-header">{title}</div>}
      <div className="overflow-auto">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(col.numeric && "text-right", col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={idx}
                style={{ background: idx % 2 === 0 ? "#000000" : "#060606" }}
              >
                {columns.map((col) => {
                  const keyStr = col.key.toString()
                  const value = keyStr.includes('.')
                    ? keyStr.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], row)
                    : row[col.key as keyof T]
                  return (
                    <td
                      key={String(col.key)}
                      className={cn(
                        col.numeric && "text-right",
                        col.className
                      )}
                    >
                      {col.render ? col.render(value, row) : String(value ?? '-')}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
