/**
 * TabMacro — Macroeconomía argentina
 *
 * API: /api/macro?endpoint=emae
 *      /api/macro?endpoint=ipc
 *      /api/macro?endpoint=ipi
 *      /api/macro?endpoint=balanza
 *      /api/macro?endpoint=fiscal
 *
 * Portado de EconData_argy SeccionMacro.js + SeccionIPC.js
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { BBGAreaChart } from "../charts/bbg-area-chart"

// ── Types ─────────────────────────────────────────────────────────────────────

type Serie = [string, number][]
type MacroData = Record<string, Serie>

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined, dec = 1): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function varColor(v: number | null | undefined): string {
  if (v == null) return "#555"
  return v >= 0 ? "#4AF6C3" : "#FF433D"
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
        background: "#0a0a0a",
        border: "1px solid #1a1a1a",
        padding: "10px 14px",
        flex: "1 1 160px",
      }}
    >
      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? "#FFA028", fontFamily: "monospace" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>{unit}</div>
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

// ── Mini table ─────────────────────────────────────────────────────────────────

function MiniTable({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div style={{ background: "#060606", border: "1px solid #1a1a1a" }}>
      <div style={{ padding: "4px 8px", background: "#0d0d0d", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #111" }}>
        {title}
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "4px 8px",
            background: i % 2 === 0 ? "#060606" : "#080808",
            fontSize: 11,
          }}
        >
          <span style={{ color: "#888" }}>{r.label}</span>
          <span style={{ color: r.color ?? "#fff", fontFamily: "monospace", fontWeight: 600 }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Sub-tab bar ────────────────────────────────────────────────────────────────

function SubTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #222", marginBottom: 1 }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            background: active === t.key ? "#0d0d0d" : "transparent",
            color: active === t.key ? "#FFA028" : "#555",
            border: "none",
            borderBottom: active === t.key ? "2px solid #FFA028" : "2px solid transparent",
            padding: "6px 14px",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 1,
            cursor: "pointer",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── IPC Ponderaciones ─────────────────────────────────────────────────────────

const PONDERACIONES = [
  { cat: "Alimentos y bebidas", actual: 25.4, propuesto: 22.4 },
  { cat: "Beb. alcohólicas/tabaco", actual: 2.3, propuesto: 2.1 },
  { cat: "Indumentaria", actual: 6.8, propuesto: 5.8 },
  { cat: "Vivienda y servicios", actual: 9.1, propuesto: 12.6 },
  { cat: "Equipamiento hogar", actual: 7.3, propuesto: 5.9 },
  { cat: "Salud", actual: 7.5, propuesto: 9.1 },
  { cat: "Transporte", actual: 14.1, propuesto: 13.8 },
  { cat: "Comunicación", actual: 2.7, propuesto: 3.4 },
  { cat: "Recreación y cultura", actual: 7.5, propuesto: 6.5 },
  { cat: "Educación", actual: 4.3, propuesto: 5.2 },
  { cat: "Restaurantes/hoteles", actual: 7.1, propuesto: 7.8 },
  { cat: "Otros bienes/servicios", actual: 6.0, propuesto: 5.4 },
]

function PonderacionesTable() {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "4px 8px", fontSize: 9, color: "#555", borderBottom: "1px solid #222" }}>
              División COICOP
            </th>
            <th style={{ textAlign: "right", padding: "4px 8px", fontSize: 9, color: "#4FC3F7", borderBottom: "1px solid #222" }}>
              Base dic 2016 (vigente)
            </th>
            <th style={{ textAlign: "right", padding: "4px 8px", fontSize: 9, color: "#FFD54F", borderBottom: "1px solid #222" }}>
              Base 2022 (propuesto)
            </th>
            <th style={{ textAlign: "right", padding: "4px 8px", fontSize: 9, color: "#555", borderBottom: "1px solid #222" }}>
              Δ p.p.
            </th>
          </tr>
        </thead>
        <tbody>
          {PONDERACIONES.map((p, i) => {
            const delta = p.propuesto - p.actual
            return (
              <tr key={p.cat} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                <td style={{ padding: "4px 8px", fontSize: 11, color: "#aaa" }}>{p.cat}</td>
                <td style={{ padding: "4px 8px", fontSize: 11, color: "#4FC3F7", textAlign: "right", fontFamily: "monospace" }}>
                  {p.actual.toFixed(1)}%
                </td>
                <td style={{ padding: "4px 8px", fontSize: 11, color: "#FFD54F", textAlign: "right", fontFamily: "monospace" }}>
                  {p.propuesto.toFixed(1)}%
                </td>
                <td style={{ padding: "4px 8px", fontSize: 11, textAlign: "right", fontFamily: "monospace", color: delta > 0 ? "#4AF6C3" : delta < 0 ? "#FF433D" : "#555" }}>
                  {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ padding: "6px 8px", fontSize: 9, color: "#444", borderTop: "1px solid #111" }}>
        Fuente INDEC — Base 2016 usa ENGHo 2004/05 · Base 2022 usa ENGHo 2017/18 (no lanzado a feb 2026)
      </div>
    </div>
  )
}

// ── Tipos estructurales ───────────────────────────────────────────────────────

type EstructuralData = {
  pbi_usd: [string, number][]
  pbi_percapita: [string, number][]
  smvm: [string, number][]
  gini: [string, number][]
  natalidad: [string, number][]
  mortalidad_infantil: [string, number][]
  poblacion: [string, number][]
  esperanza_vida: [string, number][]
}

type LaboralData = {
  tasa_desempleo: [string, number][]
  tasa_actividad: [string, number][]
  tasa_empleo: [string, number][]
  tasa_subocupacion: [string, number][]
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({ title, source }: { title: string; source?: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 10px", background: "#0d0d0d",
      borderTop: "2px solid #1a1a1a", borderBottom: "1px solid #1a1a1a", marginTop: 8,
    }}>
      <span style={{ fontSize: 9, color: "#FFA028", textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>
        {title}
      </span>
      {source && (
        <span style={{ fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: 1 }}>{source}</span>
      )}
    </div>
  )
}

// ── EstructuralKPI ────────────────────────────────────────────────────────────

function EstructuralKPI({
  label, value, unit, year, nota, valueColor = "#4FC3F7",
}: {
  label: string; value: string | null; unit: string
  year?: string | null; nota?: string; valueColor?: string
}) {
  return (
    <div style={{
      background: "#0a0a0a", border: "1px solid #1a1a1a",
      padding: "10px 14px", flex: "1 1 160px", position: "relative",
    }}>
      {year && (
        <div style={{
          position: "absolute", top: 6, right: 8, fontSize: 8, color: "#333",
          fontFamily: "monospace", background: "#111", padding: "1px 4px", border: "1px solid #1a1a1a",
        }}>{year}</div>
      )}
      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, paddingRight: 32 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: valueColor, fontFamily: "monospace" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>{unit}</div>
      {nota && <div style={{ fontSize: 8, color: "#333", marginTop: 4, lineHeight: 1.4 }}>{nota}</div>}
    </div>
  )
}

// ── EMAE Tab ──────────────────────────────────────────────────────────────────

function EmaeView() {
  const [data, setData] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)
  const [laboralData, setLaboralData] = useState<LaboralData | null>(null)
  const [laboralLoading, setLaboralLoading] = useState(true)
  const [estructuralData, setEstructuralData] = useState<EstructuralData | null>(null)
  const [estructuralLoading, setEstructuralLoading] = useState(true)

  useEffect(() => {
    fetch("/api/macro?endpoint=emae")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))

    fetch("/api/macro?endpoint=laboral")
      .then((r) => r.json())
      .then((j) => { setLaboralData(j.data); setLaboralLoading(false) })
      .catch(() => setLaboralLoading(false))

    fetch("/api/macro?endpoint=estructural")
      .then((r) => r.json())
      .then((j) => { setEstructuralData(j.data); setEstructuralLoading(false) })
      .catch(() => setEstructuralLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando EMAE...</div>

  const ultimoEmae = data?.emae?.[0]
  const varMensual = data?.emae_var_mensual?.[0]?.[1]
  const varInteranual = data?.emae_var_interanual?.[0]?.[1]
  const recentEmae = (data?.emae ?? []).slice(0, 12).reverse()

  const desempleo    = laboralData?.tasa_desempleo?.[0]
  const actividad    = laboralData?.tasa_actividad?.[0]
  const empleo       = laboralData?.tasa_empleo?.[0]
  const subocupacion = laboralData?.tasa_subocupacion?.[0]
  const periodoLaboral = desempleo?.[0] ?? null

  const pbiRec        = estructuralData?.pbi_usd?.[0]
  const pbiPcRec      = estructuralData?.pbi_percapita?.[0]
  const smvmRec       = estructuralData?.smvm?.[0]
  const giniRec       = estructuralData?.gini?.[0]
  const natalidadRec  = estructuralData?.natalidad?.[0]
  const mortalidadRec = estructuralData?.mortalidad_infantil?.[0]
  const esperanzaRec  = estructuralData?.esperanza_vida?.[0]
  const poblacionRec  = estructuralData?.poblacion?.[0]

  // PBI en millones de USD → convertir a billones para display
  const fmtBillones = (v: number | undefined) => {
    if (!v) return null
    const abs = v * 1e6  // datos.gob.ar entrega en millones de USD
    if (abs >= 1e12) return `USD ${(abs / 1e12).toFixed(2)}T`
    return `USD ${(abs / 1e9).toFixed(0)}B`
  }

  return (
    <div>
      {/* KPIs EMAE */}
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI
          label="EMAE"
          value={ultimoEmae ? fmtNum(ultimoEmae[1]) : null}
          unit={`Índice base 2004=100 · ${ultimoEmae?.[0] ?? ""}`}
          var1={varMensual} var1Label="mensual"
          var2={varInteranual} var2Label="interanual"
        />
        <KPI label="IPI Manufacturero" value={null} unit="Ver tab IPI" />
        <KPI label="Período" value={ultimoEmae?.[0] ?? null} unit="Último dato disponible" valueColor="#888" />
      </div>

      {/* Gráfico EMAE */}
      {recentEmae.length > 0 && (
        <div style={{ padding: "8px 0" }}>
          <BBGAreaChart
            title="EMAE — EVOLUCIÓN 12 MESES"
            data={recentEmae.map(([d, v]) => ({ date: d, emae: v }))}
            areas={[{ key: "emae", name: "EMAE", color: "#FFA028" }]}
            height={280}
            formatValue={(v) => fmtNum(v)}
            defaultRange="all"
          />
        </div>
      )}

      {/* Tabla EMAE */}
      <MiniTable
        title="EMAE — Últimos 12 períodos"
        rows={recentEmae.map(([d, v]) => ({ label: d, value: fmtNum(v), color: "#FFA028" }))}
      />

      {/* ── MERCADO LABORAL ────────────────────────────────────────────── */}
      <SectionHeader
        title="Mercado Laboral — EPH"
        source={`INDEC · EPH Continua${periodoLaboral ? ` · ${periodoLaboral}` : ""}`}
      />
      {laboralLoading ? (
        <div style={{ padding: 12, color: "#555", fontSize: 11 }}>Cargando datos EPH...</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
            <KPI
              label="Tasa de Desocupación"
              value={desempleo ? fmtNum(desempleo[1]) : null}
              unit="% de la PEA · 31 aglomerados"
              valueColor={desempleo ? (desempleo[1] > 10 ? "#FF433D" : desempleo[1] > 7 ? "#FFA028" : "#4AF6C3") : "#555"}
            />
            <KPI
              label="Tasa de Actividad (PEA)"
              value={actividad ? fmtNum(actividad[1]) : null}
              unit="% de la pob. total · 14 años y más"
              valueColor="#4FC3F7"
            />
            <KPI
              label="Tasa de Empleo"
              value={empleo ? fmtNum(empleo[1]) : null}
              unit="% de la pob. total · ocupados"
              valueColor="#4AF6C3"
            />
            <KPI
              label="Tasa de Subocupación"
              value={subocupacion ? fmtNum(subocupacion[1]) : null}
              unit="% de la PEA · menos de 35hs/sem"
              valueColor="#FFD54F"
            />
          </div>
          {(laboralData?.tasa_desempleo?.length ?? 0) > 0 && (
            <MiniTable
              title="Desempleo — Últimos 12 trimestres"
              rows={(laboralData?.tasa_desempleo ?? []).slice(0, 12).map(([d, v]) => ({
                label: d,
                value: `${fmtNum(v)}%`,
                color: v > 10 ? "#FF433D" : v > 7 ? "#FFA028" : "#4AF6C3",
              }))}
            />
          )}
        </>
      )}

      {/* ── INDICADORES ESTRUCTURALES ──────────────────────────────────── */}
      <SectionHeader title="Indicadores Estructurales" source="INDEC · datos.gob.ar · World Bank" />
      {estructuralLoading ? (
        <div style={{ padding: 12, color: "#555", fontSize: 11 }}>Cargando indicadores estructurales...</div>
      ) : (
        <>
          {/* Fila 1 — Actividad económica */}
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
            <EstructuralKPI
              label="PBI" value={fmtBillones(pbiRec?.[1])}
              unit="PIB · USD corrientes · INDEC Cuentas Nacionales" year={pbiRec?.[0]} valueColor="#FFA028"
            />
            <EstructuralKPI
              label="PBI per Cápita"
              value={pbiPcRec ? `USD ${pbiPcRec[1].toLocaleString("es-AR", { maximumFractionDigits: 0 })}` : null}
              unit="USD corrientes · por habitante · INDEC" year={pbiPcRec?.[0]} valueColor="#FFA028"
            />
            <EstructuralKPI
              label="Población"
              value={poblacionRec ? `${(poblacionRec[1] / 1e6).toFixed(1)}M` : null}
              unit="Habitantes totales · proyección INDEC" year={poblacionRec?.[0]} valueColor="#4FC3F7"
            />
          </div>

          {/* Fila 2 — Sociales */}
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111", marginTop: 1 }}>
            <EstructuralKPI
              label="Coeficiente de Gini"
              value={giniRec ? fmtNum(giniRec[1], 1) : null}
              unit="Desigualdad de ingresos per cápita familiar · EPH INDEC"
              year={giniRec?.[0]}
              valueColor={giniRec ? (giniRec[1] > 45 ? "#FF433D" : giniRec[1] > 35 ? "#FFA028" : "#4AF6C3") : "#555"}
              nota="0 = igualdad perfecta · 100 = máx. desigualdad · AL promedio ≈ 45"
            />
            <EstructuralKPI
              label="SMVM"
              value={smvmRec ? `$${smvmRec[1].toLocaleString("es-AR", { maximumFractionDigits: 0 })}` : null}
              unit="Salario Mínimo Vital y Móvil · ARS · mensual · Ministerio de Trabajo"
              year={smvmRec?.[0]} valueColor="#4FC3F7"
            />
            <EstructuralKPI
              label="Esperanza de Vida" value={esperanzaRec ? `${fmtNum(esperanzaRec[1], 1)} años` : null}
              unit="Al nacer · años · World Bank" year={esperanzaRec?.[0]} valueColor="#4AF6C3"
            />
          </div>

          {/* Fila 3 — Demográficos */}
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111", marginTop: 1 }}>
            <EstructuralKPI
              label="Tasa de Natalidad" value={natalidadRec ? fmtNum(natalidadRec[1], 1) : null}
              unit="Nacimientos por cada 1.000 habitantes · INDEC" year={natalidadRec?.[0]} valueColor="#4AF6C3"
            />
            <EstructuralKPI
              label="Mortalidad Infantil" value={mortalidadRec ? fmtNum(mortalidadRec[1], 1) : null}
              unit="Muertes por cada 1.000 nacidos vivos (menores de 1 año) · INDEC"
              year={mortalidadRec?.[0]}
              valueColor={mortalidadRec ? (mortalidadRec[1] > 20 ? "#FF433D" : mortalidadRec[1] > 10 ? "#FFA028" : "#4AF6C3") : "#555"}
            />
          </div>

          <div style={{ padding: "6px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111", lineHeight: 1.6 }}>
            PBI, per cápita, población, Gini, natalidad y mortalidad: INDEC vía apis.datos.gob.ar ·
            Esperanza de vida: World Bank (SP.DYN.LE00.IN) · El año en cada tarjeta = último dato publicado disponible.
          </div>
        </>
      )}
    </div>
  )
}

// ── IPC Tab ────────────────────────────────────────────────────────────────────

function IpcView() {
  const [data, setData] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)
  const [ipcTab, setIpcTab] = useState("serie")

  useEffect(() => {
    fetch("/api/macro?endpoint=ipc")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando IPC...</div>

  const varMensual = data?.ipc_var_mensual?.[0]?.[1]
  const varInteranual = data?.ipc_var_interanual?.[0]?.[1]
  const nucleoNivel = data?.ipc_nucleo ?? []
  const nucleoMensual =
    nucleoNivel.length >= 2
      ? ((nucleoNivel[0][1] / nucleoNivel[1][1] - 1) * 100)
      : null

  const getVarMens = (key: string) => {
    const s = data?.[key] ?? []
    return s.length >= 2 ? ((s[0][1] / s[1][1] - 1) * 100) : null
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="IPC Var. Mensual" value={varMensual != null ? fmtNum(varMensual) : null} unit="% mensual" />
        <KPI label="IPC Interanual" value={varInteranual != null ? fmtNum(varInteranual) : null} unit="%" />
        <KPI
          label="IPC Núcleo"
          value={nucleoMensual != null ? fmtNum(nucleoMensual) : null}
          unit="% mensual · excl. estac. y reg."
        />
        <KPI label="Alimentos" value={getVarMens("ipc_alimentos") != null ? fmtNum(getVarMens("ipc_alimentos")) : null} unit="% mensual" />
        <KPI label="Regulados" value={getVarMens("ipc_regulados") != null ? fmtNum(getVarMens("ipc_regulados")) : null} unit="% mensual" />
        <KPI label="Estacionales" value={getVarMens("ipc_estacionales") != null ? fmtNum(getVarMens("ipc_estacionales")) : null} unit="% mensual" />
      </div>

      <SubTabs
        tabs={[
          { key: "serie", label: "Serie histórica mensual" },
          { key: "canasta", label: "Canasta 2016 vs 2022" },
        ]}
        active={ipcTab}
        onChange={setIpcTab}
      />

      {ipcTab === "serie" && (
        <MiniTable
          title="IPC Var. Mensual — Últimos 24 períodos"
          rows={(data?.ipc_var_mensual ?? []).slice(0, 24).map(([d, v]) => ({
            label: d,
            value: `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
            color: v > 5 ? "#FF433D" : v > 3 ? "#FFA028" : "#4AF6C3",
          }))}
        />
      )}

      {ipcTab === "canasta" && <PonderacionesTable />}
    </div>
  )
}

// ── Balanza Tab ────────────────────────────────────────────────────────────────

function BalanzaView() {
  const [data, setData] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/macro?endpoint=balanza")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando balanza...</div>

  const lastExpo = data?.exportaciones?.[0]?.[1]
  const lastImpo = data?.importaciones?.[0]?.[1]
  const lastSaldo = data?.saldo_comercial?.[0]?.[1]

  const rows = (data?.exportaciones ?? []).slice(0, 12).map(([d]) => ({
    d,
    expo: data?.exportaciones?.find((r) => r[0] === d)?.[1] ?? null,
    impo: data?.importaciones?.find((r) => r[0] === d)?.[1] ?? null,
    saldo: data?.saldo_comercial?.find((r) => r[0] === d)?.[1] ?? null,
  }))

  return (
    <div>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="Exportaciones" value={lastExpo != null ? lastExpo.toLocaleString("es-AR") : null} unit="USD millones" />
        <KPI label="Importaciones" value={lastImpo != null ? lastImpo.toLocaleString("es-AR") : null} unit="USD millones" />
        <KPI
          label="Saldo Comercial"
          value={lastSaldo != null ? lastSaldo.toLocaleString("es-AR") : null}
          unit="USD millones"
          valueColor={lastSaldo == null ? "#888" : lastSaldo >= 0 ? "#4AF6C3" : "#FF433D"}
        />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Período", "Exportaciones", "Importaciones", "Saldo"].map((h) => (
                <th key={h} style={{ padding: "4px 8px", fontSize: 9, color: "#555", textAlign: h === "Período" ? "left" : "right", borderBottom: "1px solid #1a1a1a" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.d} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                <td style={{ padding: "4px 8px", fontSize: 11, color: "#FFA028" }}>{r.d}</td>
                <td style={{ padding: "4px 8px", fontSize: 11, color: "#4AF6C3", textAlign: "right", fontFamily: "monospace" }}>
                  {r.expo?.toLocaleString("es-AR") ?? "—"}
                </td>
                <td style={{ padding: "4px 8px", fontSize: 11, color: "#FF433D", textAlign: "right", fontFamily: "monospace" }}>
                  {r.impo?.toLocaleString("es-AR") ?? "—"}
                </td>
                <td style={{
                  padding: "4px 8px", fontSize: 11, textAlign: "right", fontFamily: "monospace",
                  color: r.saldo == null ? "#555" : r.saldo >= 0 ? "#4AF6C3" : "#FF433D",
                }}>
                  {r.saldo?.toLocaleString("es-AR") ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Fiscal Tab ─────────────────────────────────────────────────────────────────

function FiscalView() {
  const [data, setData] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)
  const [serie, setSerie] = useState("resultado_primario")

  useEffect(() => {
    fetch("/api/macro?endpoint=fiscal")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando fiscal...</div>

  const serieOpts = [
    { key: "resultado_primario", label: "Resultado Primario" },
    { key: "resultado_financiero", label: "Resultado Financiero" },
    { key: "recaudacion", label: "Recaudación" },
  ]

  const lastPrimario = data?.resultado_primario?.[0]?.[1]
  const lastFinanciero = data?.resultado_financiero?.[0]?.[1]
  const lastRecaudacion = data?.recaudacion?.[0]?.[1]

  const selectedRows = (data?.[serie] ?? []).slice(0, 24)

  return (
    <div>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI
          label="Resultado Primario"
          value={lastPrimario != null ? lastPrimario.toLocaleString("es-AR") : null}
          unit="$ millones"
          valueColor={lastPrimario == null ? "#888" : lastPrimario >= 0 ? "#4AF6C3" : "#FF433D"}
        />
        <KPI
          label="Resultado Financiero"
          value={lastFinanciero != null ? lastFinanciero.toLocaleString("es-AR") : null}
          unit="$ millones"
          valueColor={lastFinanciero == null ? "#888" : lastFinanciero >= 0 ? "#4AF6C3" : "#FF433D"}
        />
        <KPI
          label="Recaudación"
          value={lastRecaudacion != null ? lastRecaudacion.toLocaleString("es-AR") : null}
          unit="$ millones"
          valueColor="#FFA028"
        />
      </div>

      <SubTabs tabs={serieOpts} active={serie} onChange={setSerie} />

      <MiniTable
        title={`${serieOpts.find((s) => s.key === serie)?.label} — Últimos 24 períodos`}
        rows={selectedRows.map(([d, v]) => ({
          label: d,
          value: v.toLocaleString("es-AR"),
          color: v >= 0 ? "#4AF6C3" : "#FF433D",
        }))}
      />
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

const MACRO_TABS = [
  { key: "emae", label: "EMAE" },
  { key: "ipc", label: "IPC" },
  { key: "balanza", label: "Balanza Comercial" },
  { key: "fiscal", label: "Fiscal" },
]

export function TabMacro() {
  const [activeTab, setActiveTab] = useState("emae")

  return (
    <div>
      <div className="bbg-panel-header">MACROECONOMÍA ARGENTINA — DATOS.GOB.AR / INDEC</div>
      <SubTabs tabs={MACRO_TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === "emae" && <EmaeView />}
      {activeTab === "ipc" && <IpcView />}
      {activeTab === "balanza" && <BalanzaView />}
      {activeTab === "fiscal" && <FiscalView />}
    </div>
  )
}
