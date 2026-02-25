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
          <span className="text-[9px] animate-pulse-slow" style={{ color: "#FFA028" }}>LOADING...</span>
        </div>
        <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#555555", fontSize: "10px" }}>FETCHING DATA...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bbg-panel">
        <div className="bbg-panel-header flex items-center justify-between">
          <span>{title}</span>
          <span className="text-[9px]" style={{ color: "#FF433D" }}>ERROR</span>
        </div>
        <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "4px" }}>
          <span style={{ color: "#FF433D", fontSize: "10px" }}>⚠ API UNAVAILABLE</span>
          <span style={{ color: "#555555", fontSize: "9px" }}>BCRA data temporarily unavailable</span>
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
            fontSize: "8px", color: "#555555", textTransform: "uppercase",
          }}>
            {source}
          </span>
        </div>
      )}
      {children}
    </div>
  )
}
