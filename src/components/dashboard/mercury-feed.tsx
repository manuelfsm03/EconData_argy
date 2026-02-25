"use client"

import { useState, useEffect, useCallback } from "react"

interface MercuryItem {
  id: string
  title: string
  content: string
  source: string
  tier: number
  sentiment: "bullish" | "bearish" | "neutral"
  sentiment_score: number
  pubDate: string
  url?: string
}

function getSentimentBadge(sentiment: string) {
  switch (sentiment) {
    case "bullish":
      return { emoji: "🟢", color: "#4AF6C3", label: "Bullish" }
    case "bearish":
      return { emoji: "🔴", color: "#FF433D", label: "Bearish" }
    default:
      return { emoji: "🟡", color: "#FFD700", label: "Neutral" }
  }
}

function getTierBadge(tier: number) {
  switch (tier) {
    case 1:
      return { label: "T1", color: "#FFA028", desc: "Institutional" }
    case 2:
      return { label: "T2", color: "#888888", desc: "Professional" }
    default:
      return { label: "T3", color: "#555555", desc: "Community" }
  }
}

// Generate sample Mercury data for demo
function generateMercuryData(): MercuryItem[] {
  const sources = [
    { name: "Kobeissi Letter", tier: 1 },
    { name: "IEB Research", tier: 1 },
    { name: "Liz Ann Sonders", tier: 1 },
    { name: "Surfeando Merval", tier: 2 },
    { name: "FinanzasArgy", tier: 2 },
    { name: "Club de Bonos", tier: 3 },
  ]
  
  const headlines = [
    { title: "FED signals potential rate cuts in H2 2025", sentiment: "bullish" as const },
    { title: "Argentina reserves show continued improvement", sentiment: "bullish" as const },
    { title: "Inflation expectations anchored around 25%", sentiment: "neutral" as const },
    { title: "Global liquidity conditions tightening", sentiment: "bearish" as const },
    { title: "Merval technicals suggest support at 2.1M", sentiment: "neutral" as const },
    { title: "Bond spreads compressing on renewed optimism", sentiment: "bullish" as const },
    { title: "China stimulus measures impact commodities", sentiment: "neutral" as const },
    { title: "Dollar demand remains elevated in parallel markets", sentiment: "bearish" as const },
  ]
  
  const now = new Date()
  
  return headlines.map((h, i) => {
    const source = sources[i % sources.length]
    const date = new Date(now)
    date.setHours(date.getHours() - i * 2)
    
    return {
      id: `mercury-${i}`,
      title: h.title,
      content: `Detailed analysis of ${h.title.toLowerCase()}...`,
      source: source.name,
      tier: source.tier,
      sentiment: h.sentiment,
      sentiment_score: h.sentiment === "bullish" ? 0.65 : h.sentiment === "bearish" ? -0.45 : 0.1,
      pubDate: date.toISOString(),
      url: "#",
    }
  })
}

export function MercuryFeed() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [mercuryItems, setMercuryItems] = useState<MercuryItem[]>([])
  const [filterTier, setFilterTier] = useState<number | null>(null)
  const [filterSentiment, setFilterSentiment] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMercury = useCallback(async () => {
    setLoading(true)
    try {
      // In production, fetch from Mercury API
      // const res = await fetch("/api/mercury-news")
      // const data = await res.json()
      
      // For demo, use generated data
      const data = generateMercuryData()
      setMercuryItems(data)
    } catch (error) {
      console.error("Error fetching Mercury news:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMercury()
    const interval = setInterval(fetchMercury, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [fetchMercury])

  const filteredItems = mercuryItems.filter(item => {
    if (filterTier && item.tier !== filterTier) return false
    if (filterSentiment && item.sentiment !== filterSentiment) return false
    return true
  })

  const fmtTime = (date: string) => {
    try {
      return new Date(date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    } catch {
      return "--:--"
    }
  }

  const fmtDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
    } catch {
      return "--/--"
    }
  }

  return (
    <div className="bbg-panel">
      <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>MERCURY INTELLIGENCE</span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Sentiment filter */}
          <select 
            value={filterSentiment || ""} 
            onChange={(e) => setFilterSentiment(e.target.value || null)}
            style={{
              background: "#0a0a0a",
              border: "1px solid #333",
              color: "#888",
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "2px",
            }}
          >
            <option value="">Todos</option>
            <option value="bullish">🟢 Bullish</option>
            <option value="neutral">🟡 Neutral</option>
            <option value="bearish">🔴 Bearish</option>
          </select>
          
          {/* Tier filter */}
          <select 
            value={filterTier || ""} 
            onChange={(e) => setFilterTier(e.target.value ? parseInt(e.target.value) : null)}
            style={{
              background: "#0a0a0a",
              border: "1px solid #333",
              color: "#888",
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "2px",
            }}
          >
            <option value="">Todos los Tiers</option>
            <option value="1">Tier 1 - Institutional</option>
            <option value="2">Tier 2 - Professional</option>
            <option value="3">Tier 3 - Community</option>
          </select>
          
          <span style={{ color: "#555555", fontWeight: 400, fontSize: "10px" }}>
            {filteredItems.length} alerts
          </span>
        </div>
      </div>
      
      <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: "40px" }}>Time</th>
              <th style={{ width: "35px" }}>Tier</th>
              <th style={{ width: "35px" }}>Sent</th>
              <th style={{ width: "100px" }}>Source</th>
              <th>Headline</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, i) => {
              const sentiment = getSentimentBadge(item.sentiment)
              const tier = getTierBadge(item.tier)
              return (
                <tr
                  key={item.id}
                  style={{
                    background: expandedId === item.id ? "#0a0a0a" : i % 2 === 0 ? "#000000" : "#060606",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <td style={{ color: "#FFA028", fontSize: "10px", verticalAlign: "top" }}>
                    {fmtTime(item.pubDate)}
                  </td>
                  <td style={{ verticalAlign: "top" }}>
                    <span 
                      style={{ 
                        color: tier.color, 
                        fontSize: "9px", 
                        fontWeight: 600,
                        background: "#0a0a0a",
                        padding: "1px 4px",
                        borderRadius: "2px",
                      }}
                      title={tier.desc}
                    >
                      {tier.label}
                    </span>
                  </td>
                  <td style={{ verticalAlign: "top" }}>
                    <span title={sentiment.label} style={{ fontSize: "10px" }}>
                      {sentiment.emoji}
                    </span>
                  </td>
                  <td style={{ color: "#0068FF", fontSize: "10px", verticalAlign: "top" }}>
                    {item.source.toUpperCase().slice(0, 14)}
                  </td>
                  <td style={{ whiteSpace: "normal" }}>
                    <span
                      className="hover:underline"
                      style={{ color: "#FFFFFF", fontSize: "11px", cursor: "pointer" }}
                    >
                      {item.title}
                    </span>
                    <span 
                      style={{ 
                        color: sentiment.color, 
                        fontSize: "9px", 
                        marginLeft: "8px",
                        opacity: 0.8,
                      }}
                    >
                      {item.sentiment_score > 0 ? "+" : ""}{(item.sentiment_score * 100).toFixed(0)}%
                    </span>
                    {expandedId === item.id && (
                      <div style={{ color: "#888888", fontSize: "10px", marginTop: "4px", lineHeight: "1.4" }}>
                        {item.content}
                        <div style={{ marginTop: "8px", color: "#555" }}>
                          Sentimiento: <span style={{ color: sentiment.color }}>{sentiment.label}</span> | 
                          Score: {(item.sentiment_score * 100).toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "#555555", textAlign: "center", padding: "20px" }}>
                  {loading ? "CARGANDO ALERTAS..." : "NO ALERTS AVAILABLE"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}