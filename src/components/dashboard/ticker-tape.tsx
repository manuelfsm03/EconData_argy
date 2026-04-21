"use client"

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

  const items = [...quotes, ...quotes]

  return (
    <div style={{
      background: "var(--bg-elev)",
      borderBottom: "1px solid var(--border)",
      overflow: "hidden",
      height: 36,
      position: "relative",
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 48,
        background: "linear-gradient(to right, var(--bg-elev), transparent)",
        zIndex: 2, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 48,
        background: "linear-gradient(to left, var(--bg-elev), transparent)",
        zIndex: 2, pointerEvents: "none",
      }} />

      <div style={{
        display: "flex", alignItems: "center", height: "100%",
        animation: "tickertape 80s linear infinite",
        whiteSpace: "nowrap", willChange: "transform",
      }}>
        {items.map((q, i) => {
          const chg = q.change1D ?? 0
          const isUp = chg > 0
          const isDown = chg < 0
          const textColor = isUp ? "var(--positive)" : isDown ? "var(--negative)" : "var(--text-dim)"
          const bgColor = isUp
            ? "rgba(107,212,168,0.10)"
            : isDown
            ? "rgba(230,123,107,0.10)"
            : "transparent"
          const sign = isUp ? "+" : ""

          return (
            <div key={`${q.ticker}-${i}`} style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "0 22px", height: 36,
              borderRight: "1px solid var(--border)",
            }}>
              <span style={{
                fontSize: 10, fontWeight: 600, color: "var(--text-dim)",
                letterSpacing: 0.6, textTransform: "uppercase",
                fontFamily: "var(--font-ui)",
              }}>{q.ticker}</span>
              <span style={{
                fontSize: 12, fontWeight: 500, color: "var(--text)",
                fontFamily: "var(--font-data)", fontVariantNumeric: "tabular-nums",
              }}>
                {q.lastPrice != null ? q.lastPrice.toFixed(2) : "—"}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: textColor, background: bgColor,
                padding: "2px 6px", borderRadius: 4,
                fontFamily: "var(--font-data)", fontVariantNumeric: "tabular-nums",
              }}>
                {q.change1D != null ? `${sign}${q.change1D.toFixed(2)}%` : "—"}
              </span>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes tickertape {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
