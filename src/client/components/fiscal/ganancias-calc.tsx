"use client"

/**
 * GananciasCalc — Estimador simplificado de Impuesto a las Ganancias (4ta categoría).
 *
 * Los parámetros (MNI, deducción especial, cargas de familia, escala) se leen de
 * /data/ganancias-parametros.json. Todos los valores están marcados [a verificar con ARCA]
 * en el JSON fuente.
 *
 * AVISO OBLIGATORIO: Estimación orientativa. No reemplaza asesoramiento profesional.
 */

import { useEffect, useState } from "react"
import { AlertTriangle, ExternalLink } from "lucide-react"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TramoEscala {
  desde: number
  hasta: number | null
  alicuota: number
  fijo: number
}

interface GananciasParametros {
  mni: { valor_mensual_ars: number; descripcion: string }
  deduccion_especial: { multiplicador: number; descripcion: string }
  cargas_de_familia_mensual: {
    conyuge: { valor_ars: number; descripcion: string }
    hijo_menor_18: { valor_ars: number; descripcion: string }
  }
  escala_mensual: { tramos: TramoEscala[]; _nota: string }
  _fuente: string
  _aviso: string
  _actualizacion: string
}

// ─── Auxiliares ───────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtARS(n: number) { return `ARS ${fmt(n, 0)}` }
function fmtPct(n: number) { return `${(n * 100).toFixed(2)}%` }

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontFamily: "var(--font-data)", textTransform: "uppercase",
      letterSpacing: "0.1em", color: "var(--text-mute)", marginBottom: 6 }}>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", boxSizing: "border-box",
        background: "var(--bg)", border: "1px solid var(--border)",
        color: "var(--text)", fontFamily: "var(--font-data)", fontSize: 13,
        padding: "7px 10px", borderRadius: 4, outline: "none",
      }}
    />
  )
}

function ResultRow({ label, value, highlight, nota }: {
  label: string; value: string; highlight?: boolean; nota?: string
}) {
  return (
    <div style={{
      padding: "8px 14px", borderBottom: "1px solid var(--border-light)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-ui)" }}>{label}</span>
        <span style={{
          fontSize: 13, fontFamily: "var(--font-data)", fontWeight: highlight ? 700 : 500,
          color: highlight ? "var(--amber)" : "var(--text)",
        }}>{value}</span>
      </div>
      {nota && <div style={{ fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)", marginTop: 2 }}>{nota}</div>}
    </div>
  )
}

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "none", border: "none", cursor: "pointer", padding: 0,
        fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-ui)",
      }}
    >
      <span style={{
        width: 32, height: 16, borderRadius: 8, position: "relative", flexShrink: 0,
        background: checked ? "var(--amber)" : "var(--border)",
        transition: "background 0.15s",
        display: "inline-block",
      }}>
        <span style={{
          position: "absolute", top: 2, left: checked ? 16 : 2,
          width: 12, height: 12, borderRadius: "50%",
          background: "var(--bg-elev)", transition: "left 0.15s",
        }} />
      </span>
      {label}
    </button>
  )
}

// ─── Cálculo de impuesto ──────────────────────────────────────────────────────

function calcularImpuesto(baseImponible: number, tramos: TramoEscala[]): number {
  if (baseImponible <= 0) return 0
  for (const tramo of tramos) {
    const hasta = tramo.hasta ?? Infinity
    if (baseImponible <= hasta) {
      return tramo.fijo + (baseImponible - tramo.desde) * tramo.alicuota
    }
  }
  return 0
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function GananciasCalc() {
  const [params, setParams] = useState<GananciasParametros | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Inputs
  const [ingresoBruto, setIngresoBruto] = useState("")
  const [tieneConyuge, setTieneConyuge] = useState(false)
  const [cantHijos, setCantHijos] = useState("0")

  useEffect(() => {
    fetch("/data/ganancias-parametros.json")
      .then(r => r.json())
      .then((d: GananciasParametros) => setParams(d))
      .catch(() => setError("No se pudo cargar ganancias-parametros.json"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: "32px 24px", textAlign: "center", fontFamily: "var(--font-data)",
        color: "var(--text-mute)", fontSize: 11 }}>
        CARGANDO PARÁMETROS...
      </div>
    )
  }

  if (error || !params) {
    return (
      <div style={{ padding: "32px 24px", textAlign: "center", fontFamily: "var(--font-data)",
        color: "var(--negative)", fontSize: 11 }}>
        {error ?? "Error al cargar parámetros"}
      </div>
    )
  }

  // Cálculo
  const ingreso = parseFloat(ingresoBruto) || 0
  const hijos = Math.max(0, parseInt(cantHijos) || 0)

  const mni = params.mni.valor_mensual_ars
  const dedEspecial = mni * params.deduccion_especial.multiplicador
  const dedConyuge = tieneConyuge ? params.cargas_de_familia_mensual.conyuge.valor_ars : 0
  const dedHijos = hijos * params.cargas_de_familia_mensual.hijo_menor_18.valor_ars
  const totalDeducciones = mni + dedEspecial + dedConyuge + dedHijos

  const baseImponible = Math.max(0, ingreso - totalDeducciones)
  const impuesto = calcularImpuesto(baseImponible, params.escala_mensual.tramos)
  const alicuotaEfectiva = ingreso > 0 ? impuesto / ingreso : 0
  const ingresoNeto = ingreso - impuesto

  const hayResultado = ingreso > 0

  return (
    <div style={{ padding: "16px 18px 24px" }}>
      {/* Disclaimer principal */}
      <div style={{
        display: "flex", gap: 8, alignItems: "flex-start",
        background: "var(--amber-soft)", border: "1px solid var(--amber)",
        borderRadius: 4, padding: "10px 12px", marginBottom: 16,
      }}>
        <AlertTriangle size={14} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--amber)", lineHeight: 1.6, fontWeight: 600 }}>
            Estimación orientativa — no reemplaza asesoramiento profesional
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "var(--amber)", lineHeight: 1.6, opacity: 0.9 }}>
            Los parámetros (MNI, deducciones, escalas) están marcados como{" "}
            <strong>[a verificar con ARCA]</strong> y se actualizan periódicamente.
            Consultá en <a href="https://www.arca.gob.ar" target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--amber)" }}>arca.gob.ar</a> antes de tomar decisiones.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>
        {/* Inputs */}
        <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 4, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--text-dim)", marginBottom: 16 }}>
            Parámetros
          </div>

          <div style={{ marginBottom: 14 }}>
            <Label>Ingreso bruto mensual (ARS)</Label>
            <NumInput value={ingresoBruto} onChange={setIngresoBruto} placeholder="ej. 1.500.000" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Label>Cargas de familia</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Toggle
                label="Cónyuge / conviviente"
                checked={tieneConyuge}
                onChange={setTieneConyuge}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-ui)" }}>
                  Hijos menores de 18:
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  {[0, 1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => setCantHijos(String(n))}
                      style={{
                        width: 28, height: 28, borderRadius: 4, fontSize: 12, cursor: "pointer",
                        border: "1px solid",
                        borderColor: cantHijos === String(n) ? "var(--amber)" : "var(--border)",
                        background: cantHijos === String(n) ? "var(--amber-soft)" : "var(--bg)",
                        color: cantHijos === String(n) ? "var(--amber)" : "var(--text-dim)",
                        fontFamily: "var(--font-data)",
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Detalle deducciones */}
          <div style={{ background: "var(--bg)", border: "1px solid var(--border-light)", borderRadius: 4, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em",
              color: "var(--text-mute)", fontFamily: "var(--font-data)", marginBottom: 8 }}>
              Deducciones aplicadas <span style={{ opacity: 0.6 }}>[a verificar con ARCA]</span>
            </div>
            {[
              { label: params.mni.descripcion, val: mni },
              { label: params.deduccion_especial.descripcion, val: dedEspecial },
              ...(tieneConyuge ? [{ label: params.cargas_de_familia_mensual.conyuge.descripcion, val: dedConyuge }] : []),
              ...(hijos > 0 ? [{ label: `${hijos} hijo/s × ${fmtARS(params.cargas_de_familia_mensual.hijo_menor_18.valor_ars)}`, val: dedHijos }] : []),
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between",
                fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-dim)",
                padding: "2px 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ paddingRight: 8 }}>{row.label}</span>
                <span style={{ color: "var(--positive)", whiteSpace: "nowrap" }}>
                  — {fmtARS(row.val)}
                </span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between",
              fontSize: 11, fontFamily: "var(--font-data)", fontWeight: 600,
              color: "var(--text)", padding: "4px 0 0" }}>
              <span>Total deducciones</span>
              <span style={{ color: "var(--positive)" }}>— {fmtARS(totalDeducciones)}</span>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 4 }}>
          <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
              color: "var(--text-dim)" }}>
              Resultado estimado
            </div>
          </div>

          {!hayResultado ? (
            <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 11,
              color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
              Ingresá tu sueldo bruto mensual
            </div>
          ) : (
            <>
              <ResultRow label="Ingreso bruto mensual" value={fmtARS(ingreso)} />
              <ResultRow label="Deducciones" value={`— ${fmtARS(Math.min(totalDeducciones, ingreso))}`}
                nota="[a verificar con ARCA]" />
              <ResultRow label="Base imponible" value={fmtARS(baseImponible)} />
              <ResultRow label="Impuesto estimado" value={`— ${fmtARS(impuesto)}`}
                nota={params.escala_mensual._nota} />
              <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
              <ResultRow label="Ingreso neto estimado" value={fmtARS(ingresoNeto)} highlight />
              <ResultRow
                label="Alícuota efectiva estimada"
                value={fmtPct(alicuotaEfectiva)}
                nota="Impuesto / ingreso bruto"
              />

              {/* Tramo de escala */}
              {baseImponible > 0 && (() => {
                const tramo = params.escala_mensual.tramos.find(t =>
                  baseImponible >= t.desde && (t.hasta === null || baseImponible <= t.hasta)
                )
                return tramo ? (
                  <div style={{ padding: "8px 14px", fontSize: 10, color: "var(--text-mute)",
                    fontFamily: "var(--font-data)", borderTop: "1px solid var(--border-light)" }}>
                    Tramo marginal: {(tramo.alicuota * 100).toFixed(0)}% [a verificar con ARCA]
                  </div>
                ) : null
              })()}
            </>
          )}

          {/* Link ARCA */}
          <div style={{ padding: "10px 14px", marginTop: "auto" }}>
            <a
              href="https://www.arca.gob.ar/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 10, color: "var(--sky)", fontFamily: "var(--font-data)",
                textDecoration: "none" }}
            >
              <ExternalLink size={9} /> Consultar escala vigente en arca.gob.ar
            </a>
          </div>
        </div>
      </div>

      {/* Fuente */}
      <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
        Fuente parámetros: {params._fuente} · {params._actualizacion}
      </div>
    </div>
  )
}
