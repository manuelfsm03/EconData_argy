"use client"

/**
 * TickerTape — Franja deslizante con precios del Merval
 * Se actualiza cada 60 segundos. Scroll CSS infinito.
 */

import { useState, useEffect, useRef } from "react"

interface StockQuote {
  ticker: string
  lastPrice: number | null
  change1D: number | null
}

export function TickerTape() {
  const [quotes, setQuotes] = useState<StockQuote[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadQuotes = () => {
    fetch("/api/acciones?tape=1")
      .then((r) => r.json())
      .then((j) => setQuotes(j.data ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    loadQuotes()
    intervalRef.current = setInterval(loadQuotes, 60000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  if (quotes.length === 0) return null

  // Duplicate for infinite scroll
  const items = [...quotes, ...quotes]

  return (
    <div style={{
      background: "#0a0a0a",
      borderTop: "1px solid #1a1a1a",
      borderBottom: "1px solid #1a1a1a",
      overflow: "hidden",
      height: 24,
      position: "relative",
    }}>
      {/* Gradient fades */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 32,
        background: "linear-gradient(to right, #0a0a0a, transparent)",
        zIndex: 2,
      }} />
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 32,
        background: "linear-gradient(to left, #0a0a0a, transparent)",
        zIndex: 2,
      }} />

      {/* Scrolling content */}
      <div style={{
        display: "flex",
        alignItems: "center",
        height: "100%",
        animation: "tickertape 60s linear infinite",
        whiteSpace: "nowrap",
      }}>
        {items.map((q, i) => {
          const isUp = (q.change1D ?? 0) > 0
          const isDown = (q.change1D ?? 0) < 0
          const color = isUp ? "#4AF6C3" : isDown ? "#FF433D" : "#888"
          const arrow = isUp ? "▲" : isDown ? "▼" : "—"

          return (
            <span key={`${q.ticker}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "0 14px" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#FFA028" }}>{q.ticker}</span>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "#ccc" }}>
                {q.lastPrice != null ? q.lastPrice.toFixed(2) : "—"}
              </span>
              <span style={{ fontSize: 9, color }}>
                {arrow} {q.change1D != null ? (q.change1D >= 0 ? "+" : "") + q.change1D.toFixed(2) + "%" : "—"}
              </span>
              <span style={{ color: "#222", fontSize: 8, marginLeft: 4 }}>|</span>
            </span>
          )
        })}
      </div>

      <style>{`
        @keyframes tickertape {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
