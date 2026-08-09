/**
 * TabMundo — Mercados globales
 *
 * API: /api/mundo (Yahoo Finance chart API, sin auth)
 *
 * Portado de EconData_argy/js/components/sections/economia/SeccionMundo.js
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { BBGLineChart } from "../charts/bbg-line-chart"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area,
} from "recharts"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { GLOSSARY } from "@/lib/glossary"

function SubTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 1, background: "var(--bg-elev-2)", padding: 1, flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: "4px 10px", fontSize: 10, background: active === t.key ? "var(--border)" : "transparent",
            color: active === t.key ? "var(--amber)" : "var(--text-mute)", border: "none",
            borderBottom: active === t.key ? "2px solid var(--amber)" : "2px solid transparent",
            cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function ElectricidadMundialView() {
  const [data, setData] = useState<Record<string, unknown>[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/mundo?endpoint=electricidad")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Cargando datos de electricidad...</div>
  if (!data || data.length === 0) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Sin datos disponibles.</div>

  const lines = [
    { key: "China",                  name: "China",     color: "var(--negative)" },
    { key: "United States",          name: "EE.UU.",    color: "var(--sky)" },
    { key: "India",                  name: "India",     color: "var(--amber)" },
    { key: "European Union (27)",    name: "UE-27",     color: "var(--positive)" },
    { key: "Brazil",                 name: "Brasil",    color: "var(--yellow)" },
    { key: "Argentina",              name: "Argentina", color: "#CE93D8" },
  ]

  return (
    <div>
      <BBGLineChart
        title="GENERACIÓN DE ELECTRICIDAD POR PAÍS (TWh)"
        data={data}
        lines={lines}
        enableLineToggle
        height={320}
        yAxisLabel="TWh"
        defaultRange="all"
      />
      <div style={{ padding: "4px 10px", fontSize: 8, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
        Fuente: Our World in Data — Ember / Energy Institute Statistical Review · Licencia CC BY 4.0
      </div>
    </div>
  )
}

function PetroleoView() {
  const [dataType, setDataType] = useState<"production" | "consumption" | "reserves" | "refining">("consumption")
  const [data, setData] = useState<Record<string, unknown>[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(
    new Set(["United States", "China", "Japan", "India", "Saudi Arabia", "Russia", "Iran", "Venezuela"])
  )

  const allCountriesAvailable = [
    "United States", "China", "Japan", "India", "Saudi Arabia", "Russia", "Iran", "Venezuela",
    "Canada", "Brazil", "Mexico", "Germany", "South Korea", "France", "United Kingdom",
  ]

  const countryColors: Record<string, string> = {
    "United States": "var(--sky)",
    "China": "var(--yellow)",
    "Japan": "#FF6B6B",
    "India": "var(--amber)",
    "Saudi Arabia": "var(--positive)",
    "Russia": "var(--negative)",
    "Iran": "#CE93D8",
    "Venezuela": "#00BCD4",
    "Canada": "#81C784",
    "Brazil": "#FFB74D",
    "Mexico": "#BA68C8",
    "Germany": "#64B5F6",
    "South Korea": "#E57373",
    "France": "#FFD700",
    "United Kingdom": "#80DEEA",
  }

  useEffect(() => {
    setLoading(true)
    fetch(`/api/energia-global?endpoint=${dataType}`)
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [dataType])

  if (loading) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Cargando datos de petróleo...</div>
  if (!data) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Sin datos disponibles.</div>

  const lines = Array.from(selectedCountries)
    .map((country) => ({
      key: country,
      name: country,
      color: countryColors[country] || "var(--text-dim)",
    }))

  const titles: Record<typeof dataType, { title: string; label: string; source: string }> = {
    production: {
      title: "PRODUCCIÓN DE PETRÓLEO CRUDO",
      label: "Barriles/día",
      source: "U.S. EIA — Producción mensual",
    },
    consumption: {
      title: "CONSUMO DE PETRÓLEO CRUDO",
      label: "Barriles/día",
      source: "U.S. EIA — Consumo mensual",
    },
    reserves: {
      title: "RESERVAS PROBADAS DE PETRÓLEO",
      label: "Barriles (mil millones)",
      source: "U.S. EIA — Reservas anuales",
    },
    refining: {
      title: "CAPACIDAD DE REFINERÍA",
      label: "Barriles/día",
      source: "U.S. EIA — Capacidad de procesamiento",
    },
  }

  const config = titles[dataType]

  const toggleCountry = (country: string) => {
    const newSet = new Set(selectedCountries)
    if (newSet.has(country)) {
      newSet.delete(country)
    } else {
      newSet.add(country)
    }
    setSelectedCountries(newSet)
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 1, background: "var(--bg-elev-2)", padding: 1, marginBottom: 8, flexWrap: "wrap" }}>
        {(["production", "consumption", "reserves", "refining"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setDataType(type)}
            style={{
              padding: "4px 10px",
              fontSize: 10,
              background: dataType === type ? "var(--border)" : "transparent",
              color: dataType === type ? "var(--amber)" : "var(--text-mute)",
              border: "none",
              borderBottom: dataType === type ? "2px solid var(--amber)" : "2px solid transparent",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 700,
            }}
          >
            {{
              production: "Producción",
              consumption: "Consumo",
              reserves: "Reservas",
              refining: "Refinería",
            }[type]}
          </button>
        ))}
      </div>

      <div style={{ padding: "8px", background: "var(--bg-elev)", marginBottom: 8, borderBottom: "1px solid var(--bg-elev-2)" }}>
        <div style={{ fontSize: 9, color: "var(--text-dim)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Seleccionar países:</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {allCountriesAvailable.map((country) => (
            <button
              key={country}
              onClick={() => toggleCountry(country)}
              style={{
                padding: "4px 8px",
                fontSize: 9,
                background: selectedCountries.has(country) ? countryColors[country] : "var(--border)",
                color: selectedCountries.has(country) ? "var(--bg)" : "#666",
                border: `1px solid ${selectedCountries.has(country) ? countryColors[country] : "var(--border-hi)"}`,
                borderRadius: 3,
                cursor: "pointer",
                fontWeight: selectedCountries.has(country) ? 700 : 400,
              }}
            >
              {country}
            </button>
          ))}
        </div>
      </div>

      <BBGLineChart
        title={config.title}
        data={data}
        lines={lines}
        enableLineToggle
        height={320}
        yAxisLabel={config.label}
        defaultRange="all"
      />
      <div style={{ padding: "4px 10px", fontSize: 8, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
        Fuente: {config.source}
      </div>
    </div>
  )
}

function PolymarketView() {
  const [categoria, setCategoria] = useState<"politics" | "economics" | "geopolitics">("politics")
  const [data, setData] = useState<
    Array<{
      question: string
      slug: string
      probability: number
      volume24h: number
      liquidity: number
      category: string
      endDate: string
    }> | null
  >(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/polymarket?category=${categoria}`)
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [categoria])

  if (loading) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Cargando mercados de predicción...</div>
  if (!data) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Sin datos disponibles.</div>

  return (
    <div>
      <div style={{ display: "flex", gap: 1, background: "var(--bg-elev-2)", padding: 1, marginBottom: 8, flexWrap: "wrap" }}>
        {(["politics", "economics", "geopolitics"] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoria(cat)}
            style={{
              padding: "4px 10px",
              fontSize: 10,
              background: categoria === cat ? "var(--border)" : "transparent",
              color: categoria === cat ? "var(--amber)" : "var(--text-mute)",
              border: "none",
              borderBottom: categoria === cat ? "2px solid var(--amber)" : "2px solid transparent",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 700,
            }}
          >
            {{
              politics: "Política",
              economics: "Economía",
              geopolitics: "Geopolítica",
            }[cat]}
          </button>
        ))}
      </div>

      <div style={{ background: "var(--bg)", border: "1px solid var(--border)", margin: 1 }}>
        <div style={{ padding: "8px", borderBottom: "1px solid var(--bg-elev-2)", fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>
          MERCADOS DE PREDICCIÓN — Ordenados por volumen 24h
        </div>

        <div>
          {data.map((market, idx) => {
            const probColor =
              market.probability > 70
                ? "var(--positive)"
                : market.probability > 50
                  ? "var(--amber)"
                  : market.probability > 30
                    ? "#FF9800"
                    : "var(--negative)"

            return (
              <div
                key={idx}
                style={{
                  padding: "12px 8px",
                  borderBottom: "1px solid var(--bg-elev-2)",
                  fontSize: 9,
                }}
              >
                <div style={{ marginBottom: 6 }}>
                  <div style={{ color: "var(--amber)", fontWeight: 600, marginBottom: 4, fontSize: 10, lineHeight: "1.3" }}>
                    {market.question}
                  </div>
                  <div style={{ color: "var(--text-dim)", fontSize: 8, marginBottom: 4 }}>
                    {market.category} · Vence: {new Date(market.endDate).toLocaleDateString("es-AR")}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ color: "var(--text-dim)", fontSize: 8, marginBottom: 2 }}>Probabilidad</div>
                    <div style={{ color: probColor, fontWeight: 700, fontSize: 14, fontFamily: "var(--font-data)" }}>
                      {market.probability.toFixed(1)}%
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ background: "var(--bg-elev-2)", height: 4, borderRadius: 2, overflow: "hidden" }}>
                      <div
                        style={{
                          background: probColor,
                          height: "100%",
                          width: `${market.probability}%`,
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "var(--text-dim)", fontSize: 8, marginBottom: 2 }}>Vol. 24h</div>
                    <div style={{ color: "var(--positive)", fontWeight: 600, fontSize: 11, fontFamily: "var(--font-data)" }}>
                      ${(market.volume24h / 1_000_000).toFixed(1)}M
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "var(--text-dim)", fontSize: 8, marginBottom: 2 }}>Liquidez</div>
                    <div style={{ color: "#FFD700", fontWeight: 600, fontSize: 11, fontFamily: "var(--font-data)" }}>
                      ${(market.liquidity / 1_000).toFixed(0)}K
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: "4px 8px", fontSize: 8, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)", background: "var(--bg-elev)" }}>
          Fuente: Polymarket CLOB API · Odds implícitas en tiempo real · Mayor volumen = mayor confianza en el mercado
        </div>
      </div>
    </div>
  )
}

function IAView() {
  const [segmento, setSegmento] = useState<"benchmarks" | "trending">("benchmarks")
  const [data, setData] = useState<unknown[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/ia?endpoint=${segmento}`)
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [segmento])

  if (loading) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Cargando datos de IA...</div>
  if (!data) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Sin datos disponibles.</div>

  return (
    <div>
      <div style={{ display: "flex", gap: 1, background: "var(--bg-elev-2)", padding: 1, marginBottom: 8, flexWrap: "wrap" }}>
        {(["benchmarks", "trending"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSegmento(type)}
            style={{
              padding: "4px 10px",
              fontSize: 10,
              background: segmento === type ? "var(--border)" : "transparent",
              color: segmento === type ? "var(--amber)" : "var(--text-mute)",
              border: "none",
              borderBottom: segmento === type ? "2px solid var(--amber)" : "2px solid transparent",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 700,
            }}
          >
            {type === "benchmarks" ? "LLM Benchmarks" : "Modelos Trending"}
          </button>
        ))}
      </div>

      {segmento === "benchmarks" && (
        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", margin: 1 }}>
          <div style={{ padding: "8px", borderBottom: "1px solid var(--bg-elev-2)", fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>
            COMPARATIVA DE LLMs — Puntuaciones en benchmarks estándar
          </div>
          <div style={{ overflowX: "auto", padding: 8 }}>
            <table style={{ fontSize: 9, width: "100%", borderCollapse: "collapse", color: "#ccc" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--amber)" }}>Modelo</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>Empresa</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>MMLU</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>HumanEval</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>GSM8K</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>MATH</th>
                </tr>
              </thead>
              <tbody>
                {(data as Array<any>).map((model, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--bg-elev-2)" }}>
                    <td style={{ padding: "6px 8px" }}>{model.model}</td>
                    <td style={{ textAlign: "center", padding: "6px 8px", fontSize: 8, color: "var(--text-dim)" }}>{model.company}</td>
                    <td style={{ textAlign: "center", padding: "6px 8px", color: model.mmlu > 86 ? "var(--positive)" : model.mmlu > 80 ? "var(--amber)" : "var(--negative)" }}>
                      {model.mmlu.toFixed(1)}
                    </td>
                    <td style={{ textAlign: "center", padding: "6px 8px", color: model.humaneval > 85 ? "var(--positive)" : model.humaneval > 70 ? "var(--amber)" : "var(--negative)" }}>
                      {model.humaneval.toFixed(1)}
                    </td>
                    <td style={{ textAlign: "center", padding: "6px 8px", color: model.gsm8k > 93 ? "var(--positive)" : model.gsm8k > 85 ? "var(--amber)" : "var(--negative)" }}>
                      {model.gsm8k.toFixed(1)}
                    </td>
                    <td style={{ textAlign: "center", padding: "6px 8px", color: model.math > 85 ? "var(--positive)" : model.math > 75 ? "var(--amber)" : "var(--negative)" }}>
                      {model.math.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "4px 8px", fontSize: 8, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)", background: "var(--bg-elev)" }}>
            MMLU: General Knowledge | HumanEval: Code | GSM8K: Math | MATH: Advanced Math
          </div>
        </div>
      )}

      {segmento === "trending" && (
        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", margin: 1 }}>
          <div style={{ padding: "8px", borderBottom: "1px solid var(--bg-elev-2)", fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>
            TOP MODELOS HUGGING FACE — Por descargas
          </div>
          <div style={{ padding: 8 }}>
            {(data as Array<any>).map((model, idx) => (
              <div key={idx} style={{ padding: "8px", borderBottom: "1px solid var(--bg-elev-2)", fontSize: 9 }}>
                <div style={{ color: "var(--amber)", fontWeight: 600, marginBottom: 2 }}>
                  #{idx + 1} {model.id}
                </div>
                <div style={{ color: "var(--text-dim)", fontSize: 8, marginBottom: 4 }}>
                  ⬇️ {(model.downloads / 1_000_000).toFixed(1)}M descargas · 👍 {model.likes}
                </div>
                {model.tags && model.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {model.tags.slice(0, 3).map((tag: string) => (
                      <span key={tag} style={{ background: "var(--border)", padding: "2px 6px", fontSize: 7, color: "var(--text-dim)", borderRadius: 2 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: "4px 8px", fontSize: 8, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)", background: "var(--bg-elev)" }}>
            Fuente: Hugging Face Hub API · Datos: modelos con tag 'gpt' ordenados por descargas
          </div>
        </div>
      )}
    </div>
  )
}

function SojaView() {
  const [segmento, setSegmento] = useState<"produccion" | "precio">("produccion")
  const [data, setData] = useState<Record<string, unknown>[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(
    new Set(["Brazil", "Argentina", "United States", "China", "Paraguay", "India"])
  )

  const allCountriesAvailable = [
    "Brazil", "Argentina", "United States", "China", "Paraguay", "India",
    "Bolivia", "Indonesia", "Canada", "Mexico", "Ukraine", "Russia",
  ]

  const countryColors: Record<string, string> = {
    "Brazil": "#FFB74D",
    "Argentina": "#CE93D8",
    "United States": "var(--sky)",
    "China": "var(--yellow)",
    "Paraguay": "#81C784",
    "India": "var(--amber)",
    "Bolivia": "#FF6B6B",
    "Indonesia": "#00BCD4",
    "Canada": "#64B5F6",
    "Mexico": "#BA68C8",
    "Ukraine": "#80DEEA",
    "Russia": "var(--negative)",
  }

  useEffect(() => {
    setLoading(true)
    if (segmento === "produccion") {
      fetch("https://ourworldindata.org/grapher/soybean-production.csv?tab=chart")
        .then((r) => r.text())
        .then((text) => {
          const lines = text.trim().split("\n")
          const byYear: Record<string, Record<string, unknown>> = {}
          for (const line of lines.slice(1)) {
            const parts = line.split(",")
            const entity = parts[0]?.replace(/"/g, "").trim() ?? ""
            if (!allCountriesAvailable.includes(entity)) continue
            const year = parts[2]?.trim() ?? ""
            const tonnes = parseFloat(parts[3]?.trim() ?? "")
            if (!year || isNaN(tonnes)) continue
            if (!byYear[year]) byYear[year] = { date: `${year}-01-01` }
            byYear[year][entity] = parseFloat((tonnes / 1_000_000).toFixed(2)) // Convertir a millones de toneladas
          }
          const data = Object.values(byYear)
            .sort((a, b) => (a.date as string).localeCompare(b.date as string))
          setData(data)
          setLoading(false)
        })
        .catch(() => {
          // Usar mock data si OWID no está disponible
          const mockData = [
            { date: "2021-01-01", Brazil: 133.5, Argentina: 49.0, "United States": 120.0, China: 18.5, Paraguay: 10.0, India: 12.5 },
            { date: "2022-01-01", Brazil: 123.0, Argentina: 46.0, "United States": 125.0, China: 15.0, Paraguay: 9.5, India: 14.0 },
            { date: "2023-01-01", Brazil: 128.5, Argentina: 42.0, "United States": 130.0, China: 16.5, Paraguay: 10.5, India: 13.5 },
          ]
          setData(mockData)
          setLoading(false)
        })
    } else {
      // Precio: usar Yahoo Finance
      fetch("/api/mundo?ticker=soja&hist=5y")
        .then((r) => r.json())
        .then((j) => {
          const priceData = j.data as [string, number][]
          const byDate: Record<string, Record<string, unknown>> = {}
          for (const [date, price] of priceData) {
            byDate[date] = { date, "SOJA (USD/bu)": parseFloat(price.toFixed(2)) }
          }
          setData(Object.values(byDate))
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [segmento])

  if (loading) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Cargando datos de soja...</div>
  if (!data) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Sin datos disponibles.</div>

  const isPrecio = segmento === "precio"
  const lines = isPrecio
    ? [{ key: "SOJA (USD/bu)", name: "Precio SOJA", color: "var(--amber)" }]
    : Array.from(selectedCountries)
        .map((country) => ({
          key: country,
          name: country,
          color: countryColors[country] || "var(--text-dim)",
        }))

  const toggleCountry = (country: string) => {
    const newSet = new Set(selectedCountries)
    if (newSet.has(country)) {
      newSet.delete(country)
    } else {
      newSet.add(country)
    }
    setSelectedCountries(newSet)
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 1, background: "var(--bg-elev-2)", padding: 1, marginBottom: 8, flexWrap: "wrap" }}>
        {(["produccion", "precio"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSegmento(type)}
            style={{
              padding: "4px 10px",
              fontSize: 10,
              background: segmento === type ? "var(--border)" : "transparent",
              color: segmento === type ? "var(--amber)" : "var(--text-mute)",
              border: "none",
              borderBottom: segmento === type ? "2px solid var(--amber)" : "2px solid transparent",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 700,
            }}
          >
            {type === "produccion" ? "Producción Mundial" : "Precio Futuro"}
          </button>
        ))}
      </div>

      {segmento === "produccion" && (
        <div style={{ padding: "8px", background: "var(--bg-elev)", marginBottom: 8, borderBottom: "1px solid var(--bg-elev-2)" }}>
          <div style={{ fontSize: 9, color: "var(--text-dim)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>
            Seleccionar países:
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {allCountriesAvailable.map((country) => (
              <button
                key={country}
                onClick={() => toggleCountry(country)}
                style={{
                  padding: "4px 8px",
                  fontSize: 9,
                  background: selectedCountries.has(country) ? countryColors[country] : "var(--border)",
                  color: selectedCountries.has(country) ? "var(--bg)" : "#666",
                  border: `1px solid ${selectedCountries.has(country) ? countryColors[country] : "var(--border-hi)"}`,
                  borderRadius: 3,
                  cursor: "pointer",
                  fontWeight: selectedCountries.has(country) ? 700 : 400,
                }}
              >
                {country}
              </button>
            ))}
          </div>
        </div>
      )}

      <BBGLineChart
        title={segmento === "produccion" ? "PRODUCCIÓN MUNDIAL DE SOJA" : "PRECIO FUTURO DE SOJA"}
        data={data}
        lines={lines}
        enableLineToggle
        height={320}
        yAxisLabel={segmento === "produccion" ? "Millones de toneladas" : "USD/bushel"}
        defaultRange="all"
      />
      <div style={{ padding: "4px 10px", fontSize: 8, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
        Fuente: {segmento === "produccion" ? "Our World in Data (FAO)" : "Yahoo Finance — Contrato ZS=F"}
      </div>
    </div>
  )
}

// ISO3 → display name mapping
const ISO3_LABEL: Record<string, string> = {
  ARG: "Argentina", BRA: "Brazil", USA: "United States", CHN: "China",
  MEX: "México", CHL: "Chile", COL: "Colombia", DEU: "Alemania",
  JPN: "Japón", IND: "India",
}

function MacroComparadaView() {
  const [rawData, setRawData] = useState<Record<string, [string, number][]> | null>(null)
  const [loading, setLoading] = useState(true)
  const [indicador, setIndicador] = useState("gdp_growth")

  useEffect(() => {
    setLoading(true)
    fetch(`/api/world-macro?indicator=${indicador}`)
      .then((r) => r.json())
      .then((j) => { setRawData(j.data ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [indicador])

  if (loading) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Cargando macro comparada...</div>
  if (!rawData || Object.keys(rawData).length === 0) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Sin datos disponibles.</div>

  // Transform { ARG: [["2023", 133.5], ...] } → [{ date: "2023-01-01", Argentina: 133.5, ... }]
  const yearMap: Record<string, Record<string, unknown>> = {}
  for (const [iso, series] of Object.entries(rawData)) {
    const label = ISO3_LABEL[iso] ?? iso
    for (const [year, value] of series) {
      if (!yearMap[year]) yearMap[year] = { date: `${year}-01-01` }
      yearMap[year][label] = value
    }
  }
  const data = Object.values(yearMap).sort((a, b) => (a.date as string).localeCompare(b.date as string))

  const indicadores = [
    { key: "gdp_growth", label: "Crecimiento PIB (%)" },
    { key: "inflation", label: "Inflación (%)" },
    { key: "unemployment", label: "Desempleo (%)" },
  ]

  const lines = [
    { key: "Argentina",     name: "Argentina",  color: "#CE93D8" },
    { key: "Brazil",        name: "Brasil",     color: "var(--yellow)" },
    { key: "Chile",         name: "Chile",      color: "var(--amber)" },
    { key: "Colombia",      name: "Colombia",   color: "var(--positive)" },
    { key: "México",        name: "México",     color: "var(--sky)" },
    { key: "United States", name: "EEUU",       color: "var(--negative)" },
    { key: "Alemania",      name: "Alemania",   color: "#90CAF9" },
    { key: "China",         name: "China",      color: "#EF9A9A" },
  ]

  return (
    <div>
      <div style={{ padding: "4px 8px", background: "var(--bg-elev)", marginBottom: 8, borderBottom: "1px solid var(--bg-elev-2)" }}>
        <select
          value={indicador}
          onChange={(e) => setIndicador(e.target.value)}
          style={{
            background: "var(--bg-elev-2)",
            border: "1px solid var(--border)",
            color: "var(--amber)",
            padding: "4px 8px",
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {indicadores.map((ind) => (
            <option key={ind.key} value={ind.key}>{ind.label}</option>
          ))}
        </select>
      </div>

      <BBGLineChart
        title={`MACRO COMPARADA — ${indicadores.find(i => i.key === indicador)?.label || "Indicador"}`}
        data={data}
        lines={lines}
        enableLineToggle
        height={300}
        yAxisLabel="%"
        defaultRange="all"
      />
      <div style={{ padding: "4px 10px", fontSize: 8, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
        Fuente: World Bank Open Data · Licencia CC BY 4.0
      </div>
    </div>
  )
}

interface QuoteResult {
  precio: number
  variacion_pct: number
  ticker: string
}

type Snapshot = Record<string, QuoteResult | null>

const GRUPOS: Record<string, string[]> = {
  Índices: ["sp500", "nasdaq", "dow", "merval", "vix"],
  Commodities: ["soja", "maiz", "trigo", "petroleo", "oro"],
  FX: ["eurusd", "usdbrl", "usdcny", "dxy"],
  "Renta Fija / Crypto": ["us10y", "brent", "bitcoin", "ethereum"],
}

const TICKER_LABELS: Record<string, string> = {
  sp500: "S&P 500",
  nasdaq: "NASDAQ",
  dow: "DOW",
  merval: "MERVAL",
  vix: "VIX",
  soja: "SOJA",
  maiz: "MAÍZ",
  trigo: "TRIGO",
  petroleo: "WTI",
  oro: "ORO",
  eurusd: "EUR/USD",
  usdbrl: "USD/BRL",
  usdcny: "USD/CNY",
  dxy: "DXY",
  us10y: "US 10Y",
  brent: "BRENT",
  bitcoin: "BTC",
  ethereum: "ETH",
}

function QuoteCard({
  nombre,
  data,
  selected,
  onClick,
}: {
  nombre: string
  data: QuoteResult | null
  selected: boolean
  onClick: () => void
}) {
  const isPositive = (data?.variacion_pct ?? 0) >= 0
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? "var(--bg-elev-2)" : "var(--bg)",
        border: `1px solid ${selected ? "var(--amber)" : "var(--border)"}`,
        padding: "8px 10px",
        cursor: "pointer",
        textAlign: "left",
        minWidth: 80,
        flex: "1 1 80px",
      }}
    >
      <div style={{ fontSize: 9, color: selected ? "var(--amber)" : "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "flex", alignItems: "center", gap: 2 }}>
        {TICKER_LABELS[nombre] ?? nombre.toUpperCase()}
        {(() => { const lbl = TICKER_LABELS[nombre] ?? nombre.toUpperCase(); const g = GLOSSARY[lbl]; return g ? <InfoTooltip text={g.text} source={g.source} url={g.url} position="bottom" /> : null })()}
      </div>
      <div style={{ fontSize: 14, fontFamily: "var(--font-data)", fontWeight: 700, color: "var(--text)" }}>
        {data?.precio != null ? data.precio.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
      </div>
      <div
        style={{
          fontSize: 10,
          fontFamily: "var(--font-data)",
          color: data?.variacion_pct == null ? "var(--text-mute)" : isPositive ? "var(--positive)" : "var(--negative)",
          marginTop: 2,
        }}
      >
        {data?.variacion_pct != null
          ? `${isPositive ? "+" : ""}${data.variacion_pct.toFixed(2)}%`
          : "—"}
      </div>
    </button>
  )
}

// ── Helper functions ──────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined, dec = 1): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function varColor(v: number | null | undefined): string {
  if (v == null) return "var(--text-mute)"
  return v >= 0 ? "var(--positive)" : "var(--negative)"
}

function varSign(v: number | null | undefined): string {
  if (v == null) return ""
  return v >= 0 ? "+" : ""
}

// ── KPI Block ─────────────────────────────────────────────────────────────────

function KPI({
  label,
  value,
  unit,
  var1,
  var1Label,
  var2,
  var2Label,
  valueColor,
}: {
  label: string
  value: string | null
  unit: string
  var1?: number | null
  var1Label?: string
  var2?: number | null
  var2Label?: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--border)",
        padding: "10px 14px",
        flex: "1 1 160px",
      }}
    >
      <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? "var(--amber)", fontFamily: "var(--font-data)" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>{unit}</div>
      {var1 != null && (
        <div style={{ fontSize: 10, color: varColor(var1), marginTop: 4 }}>
          {varSign(var1)}{fmtNum(var1)}% {var1Label}
        </div>
      )}
      {var2 != null && (
        <div style={{ fontSize: 10, color: varColor(var2) }}>
          {varSign(var2)}{fmtNum(var2)}% {var2Label}
        </div>
      )}
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PiramideRow = { age: string; varones: number; mujeres: number }
type PiramideMeta = { year: string; country: string; total_m: number; total_f: number; total: number; proyeccion: boolean }
type SeriePt = { year: number; total_m: number; total_f: number; total: number }

type DesigualdadData = {
  gini_arg: [string, number][]
  gini_mundo: { pais: string; gini: number }[]
  informalidad: { productiva: [string, number][]; legal: [string, number][] }
  desempleo_mundial: Record<string, unknown>[]
}

// ── Países para el explorador de pirámides ────────────────────────────────────
const PAISES = [
  // América del Sur
  { code: "32",  name: "Argentina" },
  { code: "68",  name: "Bolivia" },
  { code: "76",  name: "Brasil" },
  { code: "152", name: "Chile" },
  { code: "170", name: "Colombia" },
  { code: "218", name: "Ecuador" },
  { code: "600", name: "Paraguay" },
  { code: "604", name: "Perú" },
  { code: "858", name: "Uruguay" },
  { code: "862", name: "Venezuela" },
  // América del Norte y Central
  { code: "124", name: "Canadá" },
  { code: "484", name: "México" },
  { code: "840", name: "Estados Unidos" },
  // Europa
  { code: "276", name: "Alemania" },
  { code: "724", name: "España" },
  { code: "250", name: "Francia" },
  { code: "380", name: "Italia" },
  { code: "643", name: "Rusia" },
  { code: "826", name: "Reino Unido" },
  { code: "792", name: "Turquía" },
  // Asia
  { code: "156", name: "China" },
  { code: "356", name: "India" },
  { code: "392", name: "Japón" },
  { code: "410", name: "Corea del Sur" },
  { code: "682", name: "Arabia Saudita" },
  // África y Oceanía
  { code: "566", name: "Nigeria" },
  { code: "710", name: "Sudáfrica" },
  { code: "818", name: "Egipto" },
  { code: "36",  name: "Australia" },
  // Mundo
  { code: "900", name: "Mundo" },
]

// ── Componente reutilizable de pirámide ───────────────────────────────────────
function PyramidChart({ data, height = 400 }: { data: PiramideRow[]; height?: number }) {
  const total = data.reduce((s, r) => s + Math.abs(r.varones) + r.mujeres, 0) || 1
  const pctData = [...data].reverse().map(r => ({
    age: r.age,
    varones: parseFloat(((r.varones / total) * 100).toFixed(3)),
    mujeres: parseFloat(((r.mujeres / total) * 100).toFixed(3)),
    varones_abs: Math.abs(r.varones),
    mujeres_abs: r.mujeres,
  }))
  const maxPct = pctData.length > 0
    ? Math.max(...pctData.map(r => Math.max(Math.abs(r.varones), r.mujeres)))
    : 8
  const domain = Math.ceil(maxPct * 1.15)
  const fmtAbs = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1000)}k`

  return (
    <>
      {/* Hombre / Mujer labels */}
      <div style={{ display: "flex", justifyContent: "space-around", padding: "6px 52px 2px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        <span style={{ color: "var(--sky)" }}>◀ Hombre</span>
        <span style={{ color: "#F48FB1" }}>Mujer ▶</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={pctData}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 40, bottom: 4 }}
          barCategoryGap="10%"
          barGap={1}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            domain={[-domain, domain]}
            tickFormatter={(v: number) => `${Math.abs(v).toFixed(0)}%`}
            tick={{ fontSize: 8, fill: "var(--text-mute)" }}
            axisLine={{ stroke: "var(--border-hi)" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="age"
            tick={{ fontSize: 8, fill: "var(--text-dim)" }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            contentStyle={{ background: "var(--bg-elev)", border: "1px solid var(--border)", fontSize: 10, borderRadius: 4 }}
            labelStyle={{ color: "var(--text-dim)", fontWeight: 700 }}
            formatter={(value, name, props) => {
              const num = typeof value === "number" ? value : Number(value ?? NaN)
              if (!Number.isFinite(num)) return ["—", name]
              const payload = props && typeof props === "object" && "payload" in props ? (props.payload as { varones_abs?: number; mujeres_abs?: number } | undefined) : undefined
              const abs = name === "varones"
                ? (payload?.varones_abs ?? 0)
                : (payload?.mujeres_abs ?? 0)
              const label = name === "varones" ? "Hombre" : "Mujer"
              return [`${Math.abs(num).toFixed(2)}%  (${fmtAbs(abs)})`, label]
            }}
          />
          <ReferenceLine x={0} stroke="var(--border-hi)" strokeWidth={1} />
          <Bar dataKey="varones" fill="var(--sky)" radius={[0, 2, 2, 0]} maxBarSize={14} />
          <Bar dataKey="mujeres" fill="#F48FB1" radius={[2, 0, 0, 2]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </>
  )
}

// ── Gráfico de serie de población total 1950–2100 ─────────────────────────────
function PoblacionSerieChart({ country, selectedYear }: { country: string; selectedYear: number }) {
  const [serie, setSerie] = useState<SeriePt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const years = Array.from({ length: 16 }, (_, i) => 1950 + i * 10)
    Promise.all(
      years.map(y =>
        fetch(`/api/macro?endpoint=piramide&year=${y}&country=${country}`)
          .then(r => r.json())
          .then(j => j.total ? ({ year: y, total_m: j.total_m, total_f: j.total_f, total: j.total }) : null)
          .catch(() => null)
      )
    ).then(results => {
      setSerie(results.filter(Boolean) as SeriePt[])
      setLoading(false)
    })
  }, [country])

  const fmtPop = (v: number) =>
    v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : `${(v / 1e6).toFixed(0)}M`

  return (
    <div className="bbg-panel" style={{ marginTop: 8 }}>
      <div className="bbg-panel-header">POBLACIÓN TOTAL — EVOLUCIÓN 1950–2100</div>
      {loading ? (
        <div style={{ padding: 24, color: "var(--text-dim)", textAlign: "center", fontSize: 11 }}>Cargando serie de población...</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={serie} margin={{ top: 8, right: 20, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 8, fill: "var(--text-mute)" }}
              axisLine={{ stroke: "var(--border-hi)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 8, fill: "var(--text-mute)" }}
              axisLine={{ stroke: "var(--border-hi)" }}
              tickLine={false}
              tickFormatter={(v: number) => fmtPop(v)}
            />
            <Tooltip
              contentStyle={{ background: "var(--bg-elev)", border: "1px solid var(--border)", fontSize: 10, borderRadius: 4 }}
              labelStyle={{ color: "var(--text-dim)", fontWeight: 700 }}
              formatter={(value) => {
                const num = typeof value === "number" ? value : Number(value ?? NaN)
                return Number.isFinite(num) ? fmtPop(num) : "—"
              }}
            />
            <Area type="monotone" dataKey="total" fill="var(--amber)" stroke="var(--amber)" fillOpacity={0.4} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Pirámides View ─────────────────────────────────────────────────────────────
function PiramidesView() {
  const [country, setCountry] = useState("32")
  const [year, setYear] = useState(2025)
  const [data, setData] = useState<PiramideRow[]>([])
  const [meta, setMeta] = useState<PiramideMeta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/macro?endpoint=piramide&year=${year}&country=${country}`)
      .then(r => r.json())
      .then(j => { setData(j.data ?? []); setMeta(j); setLoading(false) })
      .catch(() => setLoading(false))
  }, [country, year])

  const paisName = PAISES.find(p => p.code === country)?.name ?? country

  return (
    <div>
      {/* Panel de controles */}
      <div className="bbg-panel" style={{ marginBottom: 8 }}>
        <div className="bbg-panel-header">EXPLORADOR DE PIRÁMIDES POBLACIONALES</div>
        <div style={{ padding: "10px 12px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>

          {/* Selector de país */}
          <div>
            <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>País</div>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              style={{ background: "var(--bg-elev)", color: "#ccc", border: "1px solid var(--border-hi)", padding: "5px 10px", fontSize: 11, borderRadius: 2, cursor: "pointer" }}
            >
              {PAISES.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </div>

          {/* Selector de año */}
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              Año:&nbsp;
              <span style={{ color: year > 2025 ? "var(--amber)" : "var(--positive)", fontWeight: 700, fontFamily: "var(--font-data)" }}>{year}</span>
              {year > 2025 && <span style={{ color: "var(--amber)", marginLeft: 6 }}>· PROYECCIÓN ONU</span>}
            </div>
            <input
              type="range" min={1950} max={2100} step={1} value={year}
              onChange={e => setYear(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--amber)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "var(--text-dim)", marginTop: 2 }}>
              <span>1950</span><span>2025</span><span>2100</span>
            </div>
          </div>

          {/* Accesos rápidos de año */}
          <div>
            <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Acceso rápido</div>
            <div style={{ display: "flex", gap: 2 }}>
              {[1950, 1975, 2000, 2025, 2050, 2075, 2100].map(y => (
                <button key={y} onClick={() => setYear(y)} style={{
                  fontSize: 8, padding: "3px 6px", border: "none", borderRadius: 2, cursor: "pointer",
                  background: year === y ? "var(--amber)" : "var(--border)",
                  color: year === y ? "var(--bg)" : "var(--text-mute)",
                }}>{y}</button>
              ))}
            </div>
          </div>

          {/* Stats */}
          {meta && (
            <div style={{ display: "flex", gap: 16, marginLeft: "auto" }}>
              {[
                { label: "Total", value: `${(meta.total / 1e6).toFixed(1)}M`, color: "var(--text)" },
                { label: "Varones", value: `${(meta.total_m / 1e6).toFixed(1)}M`, color: "var(--sky)" },
                { label: "Mujeres", value: `${(meta.total_f / 1e6).toFixed(1)}M`, color: "#F48FB1" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase" }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: "var(--font-data)" }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pirámide */}
      <div className="bbg-panel">
        <div className="bbg-panel-header">
          {paisName.toUpperCase()} · {year}
          {meta?.proyeccion && <span style={{ fontSize: 8, fontWeight: 400, color: "var(--amber)", marginLeft: 8 }}>· PROYECCIÓN ONU</span>}
        </div>
        {loading ? (
          <div style={{ padding: 40, color: "var(--text-dim)", textAlign: "center", fontSize: 11 }}>Cargando pirámide de {paisName}...</div>
        ) : data.length > 0 ? (
          <>
            <PyramidChart data={data} height={480} />
            <div style={{ padding: "4px 12px 8px", fontSize: 8, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
              Fuente: populationpyramid.net · UN World Population Prospects 2024 · Años &gt;2025 = proyecciones ONU · Código de país: {country}
            </div>
          </>
        ) : (
          <div style={{ padding: 40, color: "var(--text-dim)", textAlign: "center", fontSize: 11 }}>Sin datos disponibles para {paisName} {year}</div>
        )}
      </div>

      <PoblacionSerieChart country={country} selectedYear={year} />
    </div>
  )
}

// ── Desigualdad View ───────────────────────────────────────────────────────────
function DesigualdadView() {
  const [data, setData] = useState<DesigualdadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState("gini_arg")

  useEffect(() => {
    fetch("/api/macro?endpoint=argendata_desigualdad")
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 12, color: "var(--text-dim)", fontSize: 11 }}>Cargando indicadores de desigualdad...</div>
  if (!data) return <div style={{ padding: 12, color: "var(--text-dim)", fontSize: 11 }}>Sin datos disponibles</div>

  const giniUltimo    = data.gini_arg[data.gini_arg.length - 1]
  const giniMin       = data.gini_arg.reduce((a, b) => b[1] < a[1] ? b : a, data.gini_arg[0])
  const giniMax       = data.gini_arg.reduce((a, b) => b[1] > a[1] ? b : a, data.gini_arg[0])
  const prodUlt       = data.informalidad.productiva[data.informalidad.productiva.length - 1]
  const legalUlt      = data.informalidad.legal[data.informalidad.legal.length - 1]
  const giniMundoRank = [...data.gini_mundo].sort((a, b) => b.gini - a.gini).slice(0, 20)
  const giniArgRank   = giniMundoRank.findIndex(r => r.pais === "Argentina") + 1
  const maxGini       = giniMundoRank[0]?.gini ?? 60
  const giniArgData   = data.gini_arg.map(([date, gini]) => ({ date, gini }))
  const infData = (() => {
    const m = new Map<string, { date: string; productiva: number | null; legal: number | null }>()
    for (const [d, v] of data.informalidad.productiva) m.set(d, { date: d, productiva: v, legal: m.get(d)?.legal ?? null })
    for (const [d, v] of data.informalidad.legal) { const r = m.get(d) ?? { date: d, productiva: null, legal: null }; m.set(d, { ...r, legal: v }) }
    return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date))
  })()

  return (
    <div>
      <SubTabs tabs={[
        { key: "gini_arg",     label: "Gini ARG" },
        { key: "gini_mundo",   label: "Gini Mundial" },
        { key: "informalidad", label: "Informalidad" },
      ]} active={subTab} onChange={setSubTab} />

      {subTab === "gini_arg" && (<>
        <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "var(--bg-elev-2)" }}>
          <KPI label="Gini Actual"       value={giniUltimo ? fmtNum(giniUltimo[1], 1) : null}
            unit={`Escala 0-100 · ${giniUltimo?.[0]?.slice(0, 4) ?? ""}`} valueColor="var(--amber)" />
          <KPI label="Mínimo histórico" value={giniMin ? fmtNum(giniMin[1], 1) : null}
            unit={`Mayor igualdad · ${giniMin?.[0]?.slice(0, 4) ?? ""}`} valueColor="var(--positive)" />
          <KPI label="Máximo histórico" value={giniMax ? fmtNum(giniMax[1], 1) : null}
            unit={`Mayor desigualdad · ${giniMax?.[0]?.slice(0, 4) ?? ""}`} valueColor="var(--negative)" />
        </div>
        <div style={{ padding: "8px 0" }}>
          <BBGLineChart title="COEFICIENTE DE GINI — ARGENTINA 1974-2024" data={giniArgData}
            lines={[{ key: "gini", name: "Gini", color: "var(--amber)" }]}
            height={240} yAxisLabel="Índice Gini" formatValue={v => fmtNum(v, 1)} defaultRange="all" showZeroLine={false} />
        </div>
        <div style={{ padding: "4px 10px", fontSize: 8, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
          CEDLAS con base en EPH/INDEC · Empalme metodológico entre encuestas · Cobertura urbana · vía Argendata/Fundar (CC BY-NC-ND 4.0)
        </div>
      </>)}

      {subTab === "gini_mundo" && (<>
        <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "var(--bg-elev-2)" }}>
          <KPI label="Gini ARG"                  value={giniUltimo ? fmtNum(giniUltimo[1], 1) : null} unit="Escala 0-100" valueColor="var(--amber)" />
          <KPI label="Ranking (más desiguales)" value={giniArgRank > 0 ? `#${giniArgRank}` : null}
            unit={`de ${data.gini_mundo.length} países`} valueColor="var(--amber)" />
        </div>
        <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "12px 16px", marginTop: 8 }}>
          <div style={{ fontSize: 9, color: "var(--amber)", letterSpacing: 1.5, fontWeight: 700, marginBottom: 12 }}>
            GINI MUNDIAL — TOP 20 PAÍSES MÁS DESIGUALES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {giniMundoRank.map(r => {
              const isArg = r.pais === "Argentina"
              const barPct = r.gini / maxGini * 78
              return (
                <div key={r.pais} style={{ display: "grid", gridTemplateColumns: "130px 1fr 44px", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 9, color: isArg ? "var(--amber)" : "var(--text-dim)", textAlign: "right",
                    fontWeight: isArg ? 700 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.pais}</div>
                  <div style={{ position: "relative", height: 12, background: "var(--bg-elev-2)", borderRadius: 2 }}>
                    <div style={{ position: "absolute", height: "100%", borderRadius: 2,
                      background: isArg ? "var(--amber)" : "var(--sky)", opacity: 0.8, width: `${barPct}%` }} />
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "var(--font-data)",
                    color: isArg ? "var(--amber)" : "var(--sky)", textAlign: "right" }}>{r.gini.toFixed(1)}</div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ padding: "4px 10px", fontSize: 8, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)", marginTop: 4 }}>
          SEDLAC/Banco Mundial · Snapshot de último año disponible por país · vía Argendata/Fundar (CC BY-NC-ND 4.0)
        </div>
      </>)}

      {subTab === "informalidad" && (<>
        <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "var(--bg-elev-2)" }}>
          <KPI label="Informalidad Productiva" value={prodUlt ? `${fmtNum(prodUlt[1], 1)}%` : null}
            unit={`Baja productividad · ${prodUlt?.[0]?.slice(0, 4) ?? ""}`} valueColor="var(--positive)" />
          <KPI label="Informalidad Legal"       value={legalUlt ? `${fmtNum(legalUlt[1], 1)}%` : null}
            unit={`Sin aportes previsionales · ${legalUlt?.[0]?.slice(0, 4) ?? ""}`} valueColor="var(--sky)" />
        </div>
        <div style={{ padding: "8px 0" }}>
          <BBGLineChart title="TASA DE INFORMALIDAD — ARGENTINA 1988-2022" data={infData}
            lines={[
              { key: "productiva", name: "Def. Productiva", color: "var(--positive)" },
              { key: "legal",      name: "Def. Legal",      color: "var(--sky)" },
            ]}
            height={240} yAxisLabel="%" formatValue={v => `${fmtNum(v, 1)}%`} defaultRange="all" />
        </div>
        <div style={{ padding: "4px 10px", fontSize: 8, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
          Def. productiva: empleo en unidades de baja productividad · Def. legal: sin aportes al sistema previsional ·
          SEDLAC/Banco Mundial con base en EPH · vía Argendata/Fundar (CC BY-NC-ND 4.0)
        </div>
      </>)}
    </div>
  )
}

export function TabMundo() {
  const [mundoTab, setMundoTab] = useState("mercados")
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [selectedTicker, setSelectedTicker] = useState("sp500")
  const [historico, setHistorico] = useState<[string, number][] | null>(null)
  const [histLoading, setHistLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/mundo")
      if (!res.ok) return
      const j = await res.json()
      setSnapshot(j.data)
      setLastUpdate(j.updated_at)
    } catch (err) {
      console.error("[TabMundo snapshot]", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchHistorico = useCallback(async (ticker: string, period = "1y") => {
    setHistLoading(true)
    try {
      const res = await fetch(`/api/mundo?ticker=${ticker}&hist=${period}`)
      if (!res.ok) return
      const j = await res.json()
      setHistorico(j.data)
    } catch {
      // fail silently
    } finally {
      setHistLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSnapshot()
    const interval = setInterval(fetchSnapshot, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchSnapshot])

  useEffect(() => {
    fetchHistorico(selectedTicker)
  }, [selectedTicker, fetchHistorico])

  if (loading) {
    return <div style={{ padding: 24, color: "var(--text-dim)", fontSize: 11, textAlign: "center" }}>Cargando mercados...</div>
  }

  const label = TICKER_LABELS[selectedTicker] ?? selectedTicker.toUpperCase()
  const selectedData = snapshot?.[selectedTicker]

  return (
    <div>
      <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>MERCADOS MUNDIALES — YAHOO FINANCE / OWID</span>
        {lastUpdate && mundoTab === "mercados" && (
          <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>
            UPD {new Date(lastUpdate).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
      <SubTabs tabs={[
        { key: "mercados", label: "Mercados" },
        { key: "energia", label: "Electricidad" },
        { key: "petroleo", label: "Petróleo" },
        { key: "soja", label: "Soja" },
        { key: "ia", label: "IA" },
        { key: "polymarket", label: "Predicción" },
        { key: "macro", label: "Macro Comparada" },
        { key: "gini", label: "Gini Mundial" },
        { key: "piramides", label: "Pirámides" },
      ]}
        active={mundoTab} onChange={setMundoTab} />
      {mundoTab === "energia" && <ElectricidadMundialView />}
      {mundoTab === "petroleo" && <PetroleoView />}
      {mundoTab === "soja" && <SojaView />}
      {mundoTab === "ia" && <IAView />}
      {mundoTab === "polymarket" && <PolymarketView />}
      {mundoTab === "macro" && <MacroComparadaView />}
      {mundoTab === "gini" && <DesigualdadView />}
      {mundoTab === "piramides" && <PiramidesView />}
      {mundoTab === "mercados" && (<>

      {/* Groups */}
      {Object.entries(GRUPOS).map(([grupo, tickers]) => (
        <div key={grupo} style={{ marginBottom: 1 }}>
          <div style={{ padding: "3px 8px", background: "var(--bg-elev)", fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid var(--bg-elev-2)" }}>
            {grupo}
          </div>
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", background: "var(--bg-elev-2)", padding: 1, overflowX: "auto" }}>
            {tickers.map((t) => (
              <QuoteCard
                key={t}
                nombre={t}
                data={snapshot?.[t] ?? null}
                selected={selectedTicker === t}
                onClick={() => setSelectedTicker(t)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Historical series */}
      <div style={{ background: "var(--bg)", border: "1px solid var(--border)", margin: 1 }}>
        <div style={{ padding: "4px 8px", background: "var(--bg-elev-2)", borderBottom: "1px solid var(--bg-elev-2)", fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>
          {label} — Serie histórica (1 año) ·{" "}
          {selectedData?.precio != null ? selectedData.precio.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}{" "}
          <span style={{ color: (selectedData?.variacion_pct ?? 0) >= 0 ? "var(--positive)" : "var(--negative)" }}>
            {selectedData?.variacion_pct != null
              ? `${(selectedData.variacion_pct) >= 0 ? "+" : ""}${selectedData.variacion_pct.toFixed(2)}%`
              : ""}
          </span>
        </div>
        {histLoading ? (
          <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11, textAlign: "center" }}>Cargando histórico...</div>
        ) : historico && historico.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "3px 8px", fontSize: 9, color: "var(--text-dim)", textAlign: "left", borderBottom: "1px solid var(--bg-elev-2)" }}>Fecha</th>
                  <th style={{ padding: "3px 8px", fontSize: 9, color: "var(--text-dim)", textAlign: "right", borderBottom: "1px solid var(--bg-elev-2)" }}>Precio</th>
                  <th style={{ padding: "3px 8px", fontSize: 9, color: "var(--text-dim)", textAlign: "right", borderBottom: "1px solid var(--bg-elev-2)" }}>Var % (vs anterior)</th>
                </tr>
              </thead>
              <tbody>
                {historico
                  .slice()
                  .reverse()
                  .slice(0, 30)
                  .map(([d, v], i, arr) => {
                    const prev = arr[i + 1]?.[1]
                    const chg = prev && prev !== 0 ? ((v - prev) / prev) * 100 : null
                    return (
                      <tr key={d} style={{ background: i % 2 === 0 ? "var(--bg)" : "var(--bg-row-alt)" }}>
                        <td style={{ padding: "3px 8px", fontSize: 10, color: "var(--text-dim)" }}>{d}</td>
                        <td style={{ padding: "3px 8px", fontSize: 10, color: "var(--text)", textAlign: "right", fontFamily: "var(--font-data)" }}>
                          {v.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "3px 8px", fontSize: 10, textAlign: "right", fontFamily: "var(--font-data)", color: chg == null ? "var(--text-mute)" : chg >= 0 ? "var(--positive)" : "var(--negative)" }}>
                          {chg != null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%` : "—"}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 12, color: "var(--text-dim)", fontSize: 11 }}>Sin datos históricos disponibles.</div>
        )}
      </div>
      </>)}
    </div>
  )
}
