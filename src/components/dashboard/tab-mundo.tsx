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

function SubTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 1, background: "#111", padding: 1, flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: "4px 10px", fontSize: 10, background: active === t.key ? "#1a1a1a" : "transparent",
            color: active === t.key ? "#FFA028" : "#555", border: "none",
            borderBottom: active === t.key ? "2px solid #FFA028" : "2px solid transparent",
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

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando datos de electricidad...</div>
  if (!data || data.length === 0) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Sin datos disponibles.</div>

  const lines = [
    { key: "China",                  name: "China",     color: "#FF433D" },
    { key: "United States",          name: "EE.UU.",    color: "#4FC3F7" },
    { key: "India",                  name: "India",     color: "#FFA028" },
    { key: "European Union (27)",    name: "UE-27",     color: "#4AF6C3" },
    { key: "Brazil",                 name: "Brasil",    color: "#FFD54F" },
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
      <div style={{ padding: "4px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
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
    "United States": "#4FC3F7",
    "China": "#FFD54F",
    "Japan": "#FF6B6B",
    "India": "#FFA028",
    "Saudi Arabia": "#4AF6C3",
    "Russia": "#FF433D",
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

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando datos de petróleo...</div>
  if (!data) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Sin datos disponibles.</div>

  const lines = Array.from(selectedCountries)
    .map((country) => ({
      key: country,
      name: country,
      color: countryColors[country] || "#999",
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
      <div style={{ display: "flex", gap: 1, background: "#111", padding: 1, marginBottom: 8, flexWrap: "wrap" }}>
        {(["production", "consumption", "reserves", "refining"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setDataType(type)}
            style={{
              padding: "4px 10px",
              fontSize: 10,
              background: dataType === type ? "#1a1a1a" : "transparent",
              color: dataType === type ? "#FFA028" : "#555",
              border: "none",
              borderBottom: dataType === type ? "2px solid #FFA028" : "2px solid transparent",
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

      <div style={{ padding: "8px", background: "#0a0a0a", marginBottom: 8, borderBottom: "1px solid #111" }}>
        <div style={{ fontSize: 9, color: "#999", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Seleccionar países:</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {allCountriesAvailable.map((country) => (
            <button
              key={country}
              onClick={() => toggleCountry(country)}
              style={{
                padding: "4px 8px",
                fontSize: 9,
                background: selectedCountries.has(country) ? countryColors[country] : "#1a1a1a",
                color: selectedCountries.has(country) ? "#000" : "#666",
                border: `1px solid ${selectedCountries.has(country) ? countryColors[country] : "#333"}`,
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
      <div style={{ padding: "4px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
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

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando mercados de predicción...</div>
  if (!data) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Sin datos disponibles.</div>

  return (
    <div>
      <div style={{ display: "flex", gap: 1, background: "#111", padding: 1, marginBottom: 8, flexWrap: "wrap" }}>
        {(["politics", "economics", "geopolitics"] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoria(cat)}
            style={{
              padding: "4px 10px",
              fontSize: 10,
              background: categoria === cat ? "#1a1a1a" : "transparent",
              color: categoria === cat ? "#FFA028" : "#555",
              border: "none",
              borderBottom: categoria === cat ? "2px solid #FFA028" : "2px solid transparent",
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

      <div style={{ background: "#060606", border: "1px solid #1a1a1a", margin: 1 }}>
        <div style={{ padding: "8px", borderBottom: "1px solid #111", fontSize: 10, color: "#999", fontWeight: 600 }}>
          MERCADOS DE PREDICCIÓN — Ordenados por volumen 24h
        </div>

        <div>
          {data.map((market, idx) => {
            const probColor =
              market.probability > 70
                ? "#4AF6C3"
                : market.probability > 50
                  ? "#FFA028"
                  : market.probability > 30
                    ? "#FF9800"
                    : "#FF433D"

            return (
              <div
                key={idx}
                style={{
                  padding: "12px 8px",
                  borderBottom: "1px solid #111",
                  fontSize: 9,
                }}
              >
                <div style={{ marginBottom: 6 }}>
                  <div style={{ color: "#FFA028", fontWeight: 600, marginBottom: 4, fontSize: 10, lineHeight: "1.3" }}>
                    {market.question}
                  </div>
                  <div style={{ color: "#666", fontSize: 8, marginBottom: 4 }}>
                    {market.category} · Vence: {new Date(market.endDate).toLocaleDateString("es-AR")}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ color: "#999", fontSize: 8, marginBottom: 2 }}>Probabilidad</div>
                    <div style={{ color: probColor, fontWeight: 700, fontSize: 14, fontFamily: "monospace" }}>
                      {market.probability.toFixed(1)}%
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ background: "#111", height: 4, borderRadius: 2, overflow: "hidden" }}>
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
                    <div style={{ color: "#999", fontSize: 8, marginBottom: 2 }}>Vol. 24h</div>
                    <div style={{ color: "#4AF6C3", fontWeight: 600, fontSize: 11, fontFamily: "monospace" }}>
                      ${(market.volume24h / 1_000_000).toFixed(1)}M
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#999", fontSize: 8, marginBottom: 2 }}>Liquidez</div>
                    <div style={{ color: "#FFD700", fontWeight: 600, fontSize: 11, fontFamily: "monospace" }}>
                      ${(market.liquidity / 1_000).toFixed(0)}K
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: "4px 8px", fontSize: 8, color: "#333", borderTop: "1px solid #111", background: "#0a0a0a" }}>
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

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando datos de IA...</div>
  if (!data) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Sin datos disponibles.</div>

  return (
    <div>
      <div style={{ display: "flex", gap: 1, background: "#111", padding: 1, marginBottom: 8, flexWrap: "wrap" }}>
        {(["benchmarks", "trending"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSegmento(type)}
            style={{
              padding: "4px 10px",
              fontSize: 10,
              background: segmento === type ? "#1a1a1a" : "transparent",
              color: segmento === type ? "#FFA028" : "#555",
              border: "none",
              borderBottom: segmento === type ? "2px solid #FFA028" : "2px solid transparent",
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
        <div style={{ background: "#060606", border: "1px solid #1a1a1a", margin: 1 }}>
          <div style={{ padding: "8px", borderBottom: "1px solid #111", fontSize: 10, color: "#999", fontWeight: 600 }}>
            COMPARATIVA DE LLMs — Puntuaciones en benchmarks estándar
          </div>
          <div style={{ overflowX: "auto", padding: 8 }}>
            <table style={{ fontSize: 9, width: "100%", borderCollapse: "collapse", color: "#ccc" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #222" }}>
                  <th style={{ textAlign: "left", padding: "4px 8px", color: "#FFA028" }}>Modelo</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>Empresa</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>MMLU</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>HumanEval</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>GSM8K</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>MATH</th>
                </tr>
              </thead>
              <tbody>
                {(data as Array<any>).map((model, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #111" }}>
                    <td style={{ padding: "6px 8px" }}>{model.model}</td>
                    <td style={{ textAlign: "center", padding: "6px 8px", fontSize: 8, color: "#999" }}>{model.company}</td>
                    <td style={{ textAlign: "center", padding: "6px 8px", color: model.mmlu > 86 ? "#4AF6C3" : model.mmlu > 80 ? "#FFA028" : "#FF433D" }}>
                      {model.mmlu.toFixed(1)}
                    </td>
                    <td style={{ textAlign: "center", padding: "6px 8px", color: model.humaneval > 85 ? "#4AF6C3" : model.humaneval > 70 ? "#FFA028" : "#FF433D" }}>
                      {model.humaneval.toFixed(1)}
                    </td>
                    <td style={{ textAlign: "center", padding: "6px 8px", color: model.gsm8k > 93 ? "#4AF6C3" : model.gsm8k > 85 ? "#FFA028" : "#FF433D" }}>
                      {model.gsm8k.toFixed(1)}
                    </td>
                    <td style={{ textAlign: "center", padding: "6px 8px", color: model.math > 85 ? "#4AF6C3" : model.math > 75 ? "#FFA028" : "#FF433D" }}>
                      {model.math.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "4px 8px", fontSize: 8, color: "#333", borderTop: "1px solid #111", background: "#0a0a0a" }}>
            MMLU: General Knowledge | HumanEval: Code | GSM8K: Math | MATH: Advanced Math
          </div>
        </div>
      )}

      {segmento === "trending" && (
        <div style={{ background: "#060606", border: "1px solid #1a1a1a", margin: 1 }}>
          <div style={{ padding: "8px", borderBottom: "1px solid #111", fontSize: 10, color: "#999", fontWeight: 600 }}>
            TOP MODELOS HUGGING FACE — Por descargas
          </div>
          <div style={{ padding: 8 }}>
            {(data as Array<any>).map((model, idx) => (
              <div key={idx} style={{ padding: "8px", borderBottom: "1px solid #111", fontSize: 9 }}>
                <div style={{ color: "#FFA028", fontWeight: 600, marginBottom: 2 }}>
                  #{idx + 1} {model.id}
                </div>
                <div style={{ color: "#888", fontSize: 8, marginBottom: 4 }}>
                  ⬇️ {(model.downloads / 1_000_000).toFixed(1)}M descargas · 👍 {model.likes}
                </div>
                {model.tags && model.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {model.tags.slice(0, 3).map((tag: string) => (
                      <span key={tag} style={{ background: "#1a1a1a", padding: "2px 6px", fontSize: 7, color: "#666", borderRadius: 2 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: "4px 8px", fontSize: 8, color: "#333", borderTop: "1px solid #111", background: "#0a0a0a" }}>
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
    "United States": "#4FC3F7",
    "China": "#FFD54F",
    "Paraguay": "#81C784",
    "India": "#FFA028",
    "Bolivia": "#FF6B6B",
    "Indonesia": "#00BCD4",
    "Canada": "#64B5F6",
    "Mexico": "#BA68C8",
    "Ukraine": "#80DEEA",
    "Russia": "#FF433D",
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

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando datos de soja...</div>
  if (!data) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Sin datos disponibles.</div>

  const isPrecio = segmento === "precio"
  const lines = isPrecio
    ? [{ key: "SOJA (USD/bu)", name: "Precio SOJA", color: "#FFA028" }]
    : Array.from(selectedCountries)
        .map((country) => ({
          key: country,
          name: country,
          color: countryColors[country] || "#999",
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
      <div style={{ display: "flex", gap: 1, background: "#111", padding: 1, marginBottom: 8, flexWrap: "wrap" }}>
        {(["produccion", "precio"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSegmento(type)}
            style={{
              padding: "4px 10px",
              fontSize: 10,
              background: segmento === type ? "#1a1a1a" : "transparent",
              color: segmento === type ? "#FFA028" : "#555",
              border: "none",
              borderBottom: segmento === type ? "2px solid #FFA028" : "2px solid transparent",
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
        <div style={{ padding: "8px", background: "#0a0a0a", marginBottom: 8, borderBottom: "1px solid #111" }}>
          <div style={{ fontSize: 9, color: "#999", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>
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
                  background: selectedCountries.has(country) ? countryColors[country] : "#1a1a1a",
                  color: selectedCountries.has(country) ? "#000" : "#666",
                  border: `1px solid ${selectedCountries.has(country) ? countryColors[country] : "#333"}`,
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
      <div style={{ padding: "4px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
        Fuente: {segmento === "produccion" ? "Our World in Data (FAO)" : "Yahoo Finance — Contrato ZS=F"}
      </div>
    </div>
  )
}

function MacroComparadaView() {
  const [data, setData] = useState<Record<string, unknown>[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [indicador, setIndicador] = useState("gdp_growth")

  useEffect(() => {
    fetch("/api/mundo?endpoint=macro_comparada")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando macro comparada...</div>
  if (!data || data.length === 0) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Sin datos disponibles.</div>

  const indicadores = [
    { key: "gdp_growth", label: "Crecimiento PIB (%)" },
    { key: "inflation", label: "Inflación (%)" },
    { key: "unemployment", label: "Desempleo (%)" },
  ]

  const lines = [
    { key: "Argentina",    name: "Argentina",   color: "#CE93D8" },
    { key: "Brazil",       name: "Brasil",      color: "#FFD54F" },
    { key: "Chile",        name: "Chile",       color: "#FFA028" },
    { key: "Colombia",     name: "Colombia",    color: "#4AF6C3" },
    { key: "Mexico",       name: "México",      color: "#4FC3F7" },
  ]

  return (
    <div>
      <div style={{ padding: "4px 8px", background: "#0a0a0a", marginBottom: 8, borderBottom: "1px solid #111" }}>
        <select
          value={indicador}
          onChange={(e) => setIndicador(e.target.value)}
          style={{
            background: "#111",
            border: "1px solid #1a1a1a",
            color: "#FFA028",
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
        title={`AMÉRICA LATINA — ${indicadores.find(i => i.key === indicador)?.label || "Indicador"}`}
        data={data}
        lines={lines}
        enableLineToggle
        height={300}
        yAxisLabel="%"
        defaultRange="all"
      />
      <div style={{ padding: "4px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
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
        background: selected ? "#0d0d0d" : "#060606",
        border: `1px solid ${selected ? "#FFA028" : "#1a1a1a"}`,
        padding: "8px 10px",
        cursor: "pointer",
        textAlign: "left",
        minWidth: 80,
        flex: "1 1 80px",
      }}
    >
      <div style={{ fontSize: 9, color: selected ? "#FFA028" : "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {TICKER_LABELS[nombre] ?? nombre.toUpperCase()}
      </div>
      <div style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 700, color: "#fff" }}>
        {data?.precio != null ? data.precio.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
      </div>
      <div
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          color: data?.variacion_pct == null ? "#555" : isPositive ? "#4AF6C3" : "#FF433D",
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
    return <div style={{ padding: 24, color: "#555", fontSize: 11, textAlign: "center" }}>Cargando mercados...</div>
  }

  const label = TICKER_LABELS[selectedTicker] ?? selectedTicker.toUpperCase()
  const selectedData = snapshot?.[selectedTicker]

  return (
    <div>
      <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>MERCADOS MUNDIALES — YAHOO FINANCE / OWID</span>
        {lastUpdate && mundoTab === "mercados" && (
          <span style={{ color: "#444", fontWeight: 400 }}>
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
      ]}
        active={mundoTab} onChange={setMundoTab} />
      {mundoTab === "energia" && <ElectricidadMundialView />}
      {mundoTab === "petroleo" && <PetroleoView />}
      {mundoTab === "soja" && <SojaView />}
      {mundoTab === "ia" && <IAView />}
      {mundoTab === "polymarket" && <PolymarketView />}
      {mundoTab === "macro" && <MacroComparadaView />}
      {mundoTab === "mercados" && (<>

      {/* Groups */}
      {Object.entries(GRUPOS).map(([grupo, tickers]) => (
        <div key={grupo} style={{ marginBottom: 1 }}>
          <div style={{ padding: "3px 8px", background: "#0a0a0a", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #111" }}>
            {grupo}
          </div>
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", background: "#111", padding: 1, overflowX: "auto" }}>
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
      <div style={{ background: "#060606", border: "1px solid #1a1a1a", margin: 1 }}>
        <div style={{ padding: "4px 8px", background: "#0d0d0d", borderBottom: "1px solid #111", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>
          {label} — Serie histórica (1 año) ·{" "}
          {selectedData?.precio != null ? selectedData.precio.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}{" "}
          <span style={{ color: (selectedData?.variacion_pct ?? 0) >= 0 ? "#4AF6C3" : "#FF433D" }}>
            {selectedData?.variacion_pct != null
              ? `${(selectedData.variacion_pct) >= 0 ? "+" : ""}${selectedData.variacion_pct.toFixed(2)}%`
              : ""}
          </span>
        </div>
        {histLoading ? (
          <div style={{ padding: 16, color: "#555", fontSize: 11, textAlign: "center" }}>Cargando histórico...</div>
        ) : historico && historico.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "3px 8px", fontSize: 9, color: "#555", textAlign: "left", borderBottom: "1px solid #111" }}>Fecha</th>
                  <th style={{ padding: "3px 8px", fontSize: 9, color: "#555", textAlign: "right", borderBottom: "1px solid #111" }}>Precio</th>
                  <th style={{ padding: "3px 8px", fontSize: 9, color: "#555", textAlign: "right", borderBottom: "1px solid #111" }}>Var % (vs anterior)</th>
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
                      <tr key={d} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                        <td style={{ padding: "3px 8px", fontSize: 10, color: "#888" }}>{d}</td>
                        <td style={{ padding: "3px 8px", fontSize: 10, color: "#fff", textAlign: "right", fontFamily: "monospace" }}>
                          {v.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "3px 8px", fontSize: 10, textAlign: "right", fontFamily: "monospace", color: chg == null ? "#555" : chg >= 0 ? "#4AF6C3" : "#FF433D" }}>
                          {chg != null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%` : "—"}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 12, color: "#555", fontSize: 11 }}>Sin datos históricos disponibles.</div>
        )}
      </div>
      </>)}
    </div>
  )
}
