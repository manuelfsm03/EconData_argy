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
      background: "#1A1A1D",
      borderBottom: "1px solid #2A2A2F",
      overflow: "hidden",
      height: 36,
      position: "relative",
    }}>
      {/* Gradient fades */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 40,
        background: "linear-gradient(to right, #1A1A1D, transparent)",
        zIndex: 2, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 40,
        background: "linear-gradient(to left, #1A1A1D, transparent)",
        zIndex: 2, pointerEvents: "none",
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
          const chg = q.change1D ?? 0
          const isUp   = chg > 0
          const isDown = chg < 0
          const textColor = isUp ? "#6BD4A8" : isDown ? "#E67B6B" : "#A8A49D"
          const bgColor   = isUp ? "rgba(107,212,168,0.08)" : isDown ? "rgba(230,123,107,0.08)" : "transparent"
          const arrow     = isUp ? "▲" : isDown ? "▼" : "—"

          return (
            <div key={`${q.ticker}-${i}`} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "0 20px", height: 36,
              borderRight: "1px solid #2A2A2F",
            }}>
              <span style={{
                fontSize: 10, fontWeight: 600, color: "#A8A49D",
                letterSpacing: 0.6, textTransform: "uppercase",
                fontFamily: "var(--font-ui)",
              }}>
                {q.ticker}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 500, color: "#F5F3EE",
                fontFamily: "var(--font-data)", fontVariantNumeric: "tabular-nums",
              }}>
                {q.lastPrice != null ? q.lastPrice.toFixed(2) : "—"}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 500,
                color: textColor,
                background: bgColor,
                padding: "1px 5px", borderRadius: 3,
                fontFamily: "var(--font-data)",
              }}>
                {arrow} {q.change1D != null ? (q.change1D >= 0 ? "+" : "") + q.change1D.toFixed(2) + "%" : "—"}
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
