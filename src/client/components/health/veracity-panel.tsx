"use client"

/**
 * Panel de veracidad — ¿estos números tienen sentido?, más allá de si la
 * fuente respondió 200 o si el timestamp es reciente (eso ya lo cubre la
 * sección de arriba, /api/status). Reutiliza endpoints públicos que ya
 * existen en el sitio — no pega a fuentes externas nuevas.
 *
 * A propósito, fuera de alcance: todo lo de renta fija/bonos (TIR, paridad,
 * CER) — es otra área del equipo, no se audita acá.
 */

import { useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { assessAgreement, assessPlausibility, type AgreementResult, type PlausibilityResult } from "@/lib/data-plausibility"
import { StatusPill } from "./health-dashboard"

type Check =
  | { kind: "plausibility"; label: string; result: PlausibilityResult }
  | { kind: "agreement"; label: string; result: AgreementResult }

async function safeJson(path: string): Promise<unknown> {
  try {
    const response = await fetch(path, { cache: "no-store" })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

async function runChecks(): Promise<Check[]> {
  const [ipc, emae, riesgo, dolares] = await Promise.all([
    safeJson("/api/macro?endpoint=ipc"),
    safeJson("/api/macro?endpoint=emae"),
    safeJson("/api/riesgo-pais"),
    safeJson("/api/dolares"),
  ])

  // /api/macro?endpoint=ipc entrega ipc_var_mensual en proporción (0.0288 =
  // 2.88%), a propósito, para que lo multiplique quien lo muestre — misma
  // convención que ya usa IpcView en tab-macro.tsx.
  const ipcVarMensualRaw = num((ipc as { data?: { ipc_var_mensual?: [string, number][] } })?.data?.ipc_var_mensual?.[0]?.[1])
  const ipcVarMensual = ipcVarMensualRaw === null ? null : ipcVarMensualRaw * 100
  const emaeUltimo = num((emae as { data?: { emae?: [string, number][] } })?.data?.emae?.[0]?.[1])
  const riesgoBps = num((riesgo as { data?: { actual?: { riesgoPaisBps?: number } } })?.data?.actual?.riesgoPaisBps)
  const dolarOficial = num((dolares as { rates?: { oficial?: { venta?: number } } })?.rates?.oficial?.venta)
  const dolarBlue = num((dolares as { rates?: { blue?: { venta?: number } } })?.rates?.blue?.venta)

  const checks: Check[] = [
    { kind: "plausibility", label: "IPC — variación mensual", result: assessPlausibility("ipc_var_mensual", ipcVarMensual) },
    { kind: "plausibility", label: "EMAE (último dato)", result: assessPlausibility("emae", emaeUltimo) },
    { kind: "plausibility", label: "Riesgo país (EMBI+)", result: assessPlausibility("riesgo_pais_bps", riesgoBps) },
    { kind: "plausibility", label: "Dólar oficial", result: assessPlausibility("dolar_ars", dolarOficial) },
    { kind: "plausibility", label: "Dólar blue", result: assessPlausibility("dolar_ars", dolarBlue) },
    {
      kind: "agreement",
      label: "Dólar blue vs oficial — ¿la brecha es razonable?",
      result: assessAgreement({
        valueA: dolarOficial,
        valueB: dolarBlue,
        maxDeltaPct: 150,
        reason: "una brecha mayor a 150% entre blue y oficial sugiere un error de carga, no una brecha cambiaria real",
      }),
    },
  ]
  return checks
}

function pillStatus(status: "plausible" | "implausible" | "unknown" | "agree" | "disagree"): "ok" | "error" | "checking" | "unknown" {
  if (status === "plausible" || status === "agree") return "ok"
  if (status === "implausible" || status === "disagree") return "error"
  return "unknown"
}

export function VeracityPanel() {
  const [checks, setChecks] = useState<Check[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void runChecks().then((result) => { if (!cancelled) setChecks(result) })
    return () => { cancelled = true }
  }, [])

  const implausibleCount = (checks ?? []).filter((c) => pillStatus(c.result.status) === "error").length

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={16} className="text-[var(--amber)]" /> Veracidad</h2>
          <p className="text-[11px] text-[var(--text-mute)]">
            No es transporte ni frescura — es "¿este número tiene sentido?": rango plausible por métrica y acuerdo entre
            fuentes que deberían moverse juntas. No cubre renta fija/bonos.
          </p>
        </div>
        {checks && <span className="font-mono text-[10px] text-[var(--text-mute)]">{implausibleCount} fuera de rango de {checks.length}</span>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]">
        <table>
          <thead><tr><th>Métrica</th><th>Estado</th><th>Detalle</th></tr></thead>
          <tbody>
            {(checks ?? []).map((check) => <tr key={check.label}>
              <td className="font-medium text-[var(--text)]">{check.label}</td>
              <td><StatusPill status={pillStatus(check.result.status)}>{check.result.status}</StatusPill></td>
              <td className="text-[10px] text-[var(--text-dim)]">{check.result.reason}</td>
            </tr>)}
            {!checks && <tr><td colSpan={3} className="text-[11px] text-[var(--text-dim)]">Verificando...</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
