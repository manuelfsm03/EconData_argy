import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"
import {
  CATALOGO,
  escenarioDeQueryString,
  simular,
  type Posicion,
} from "@/lib/simulador/motor"

export const runtime = "edge"

const DOLAR_DEFAULT_ARS = 1000

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const esc = escenarioDeQueryString(params)

  const dolarPct = esc.dolar ?? 0
  const ipc = esc.ipc ?? 3
  const tpm = esc.tpm ?? 35
  const horizonte = esc.horizonte ?? 3

  const posicionesInput: Posicion[] = (esc.posiciones ?? [
    { tipo: "PF_TRADICIONAL", monto: 100_000 },
    { tipo: "DOLAR_MEP", monto: 100_000 },
    { tipo: "PF_UVA", monto: 100_000 },
  ]).map((p, i) => ({
    id: `p${i}`,
    tipo: p.tipo,
    nombre: CATALOGO.find(c => c.tipo === p.tipo)?.nombre ?? p.tipo,
    monto: p.monto,
  }))

  const resultado = simular(posicionesInput, {
    dolarVariacionPct: dolarPct,
    inflacionMensualPct: ipc,
    tpmTnaPct: tpm,
    horizonteMeses: horizonte,
    dolarInicialArs: DOLAR_DEFAULT_ARS,
  })

  const ganador = resultado.ganador
  const ganadorNombre = ganador?.nombre ?? "—"
  const ganadorRet = ganador ? ganador.retornoRealPct.toFixed(1) : "0.0"

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#121214",
          color: "#F5F3EE",
          fontFamily: "sans-serif",
          padding: 56,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 12,
              height: 12,
              background: "#E8944A",
              borderRadius: 2,
            }}
          />
          <span
            style={{
              fontSize: 20,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#A8A49D",
              fontWeight: 600,
            }}
          >
            La Pizarra · Simulador de escenarios
          </span>
        </div>

        <div style={{ display: "flex", marginTop: 20 }}>
          <span
            style={{
              fontSize: 46,
              lineHeight: 1.15,
              fontWeight: 700,
              color: "#F5F3EE",
              maxWidth: 1000,
            }}
          >
            ¿Qué pasa con tu plata en este escenario?
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 40,
          }}
        >
          <ScenarioCard label="Dólar" value={`${signed(dolarPct)}%`} />
          <ScenarioCard label="IPC / mes" value={`${ipc}%`} />
          <ScenarioCard label="TPM (TNA)" value={`${tpm}%`} />
          <ScenarioCard label="Horizonte" value={`${horizonte}m`} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 46,
            padding: "28px 32px",
            background: "#1A1A1D",
            border: "1px solid #2A2A2F",
            borderRadius: 14,
          }}
        >
          <span
            style={{
              fontSize: 18,
              color: "#A8A49D",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Mejor jugada (retorno real)
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 12 }}>
            <span style={{ fontSize: 52, fontWeight: 700, color: "#F5F3EE" }}>
              {ganadorNombre}
            </span>
            <span
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: Number(ganadorRet) >= 0 ? "#6BD4A8" : "#E67B6B",
              }}
            >
              {signed(Number(ganadorRet))}%
            </span>
          </div>
        </div>

        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between" }}>
          <span style={{ fontSize: 16, color: "#5F5C56" }}>
            lapizarra.ar/simulador
          </span>
          <span style={{ fontSize: 14, color: "#5F5C56" }}>
            Simulación didáctica · no es asesoramiento financiero
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}

function signed(n: number): string {
  if (n > 0) return `+${n}`
  return `${n}`
}

function ScenarioCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "18px 24px",
        background: "#1A1A1D",
        border: "1px solid #2A2A2F",
        borderRadius: 10,
        minWidth: 180,
      }}
    >
      <span
        style={{
          fontSize: 14,
          color: "#A8A49D",
          letterSpacing: 1.4,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 34, fontWeight: 700, color: "#E8944A", marginTop: 6 }}>
        {value}
      </span>
    </div>
  )
}
