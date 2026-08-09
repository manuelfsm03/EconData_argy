"use client"

import { ReactNode } from "react"

interface BBGChartPanelProps {
  title: string
  loading: boolean
  error: string | null
  source?: string
  children: ReactNode
}

export function BBGChartPanel({ title, loading, error, source, children }: BBGChartPanelProps) {
  if (loading) {
    return (
      <div className="bbg-panel">
        <div className="bbg-panel-header flex items-center justify-between">
          <span>{title}</span>
          <span className="text-[9px] animate-pulse-slow" style={{ color: "var(--amber)" }}>LOADING...</span>
        </div>
        <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "var(--text-mute)", fontSize: "10px" }}>FETCHING DATA...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bbg-panel">
        <div className="bbg-panel-header flex items-center justify-between">
          <span>{title}</span>
          <span className="text-[9px]" style={{ color: "var(--negative)" }}>ERROR</span>
        </div>
        <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "4px" }}>
          <span style={{ color: "var(--negative)", fontSize: "10px" }}>⚠ API UNAVAILABLE</span>
          <span style={{ color: "var(--text-mute)", fontSize: "9px" }}>BCRA data temporarily unavailable</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      {source && (
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", top: "4px", right: "8px", zIndex: 10,
            fontSize: "8px", color: "var(--text-mute)", textTransform: "uppercase",
          }}>
            {source}
          </span>
        </div>
      )}
      {children}
    </div>
  )
}
