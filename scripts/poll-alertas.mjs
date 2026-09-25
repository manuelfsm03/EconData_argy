#!/usr/bin/env node
// ─── Poller de alertas — corre cada 30 min desde GitHub Actions ─────────────
//
// Uso:
//   node scripts/poll-alertas.mjs
//
// Envs requeridas:
//   DATABASE_URL       — Postgres con la tabla `alertas` migrada
//   RESEND_API_KEY     — para enviar los emails (sin esto, sólo loguea)
//   APP_URL            — base del deploy (default: https://lapizarra.ar)
//
// Flujo:
//   1. Levanta todas las alertas con estado="activa"
//   2. Para cada una, evalúa la condición contra el endpoint interno:
//        - dolar             → APP_URL/api/dolares (dolarapi.com wrapper)
//        - tasa_bcra         → APP_URL/api/bcra?endpoint=plazofijo (variable tpm)
//        - publicacion_ipc   → APP_URL/api/macro?endpoint=ipc (data.ipc_general)
//   3. Si dispara: envía email vía Resend, marca ultimoDisparo=now y estado=disparada
//   4. Loguea qué evaluó y qué disparó.

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const APP_URL         = (process.env.APP_URL || "https://lapizarra.ar").replace(/\/$/, "")
const RESEND_API_KEY  = process.env.RESEND_API_KEY || ""
const FROM_EMAIL      = process.env.ALERTAS_FROM_EMAIL || "La Pizarra <alertas@lapizarra.ar>"
const DASHBOARD_URL   = process.env.LAPIZARRA_URL || "https://lapizarra.ar"

// ─── Utilidades ──────────────────────────────────────────────────────────────

function comparar(op, valor, umbral) {
  switch (op) {
    case ">":  return valor >  umbral
    case ">=": return valor >= umbral
    case "<":  return valor <  umbral
    case "<=": return valor <= umbral
    case "==": return valor === umbral
    default:   return false
  }
}

const NOMBRE_VARIEDAD = {
  blue:            "Dólar Blue",
  oficial:         "Dólar Oficial",
  bolsa:           "Dólar MEP",
  contadoconliqui: "Dólar CCL",
  mayorista:       "Dólar Mayorista",
  cripto:          "Dólar Cripto",
  tarjeta:         "Dólar Tarjeta",
}

function describir(tipo, config) {
  if (tipo === "dolar") {
    const n = NOMBRE_VARIEDAD[config.variedad] ?? config.variedad
    return `${n} ${config.operador} $${Number(config.umbral).toLocaleString("es-AR")}`
  }
  if (tipo === "tasa_bcra") {
    return `Tasa política monetaria BCRA ${config.operador} ${config.umbral}% TNA`
  }
  if (tipo === "publicacion_ipc") return "Nueva publicación mensual del IPC (INDEC)"
  return tipo
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    signal: AbortSignal.timeout(20_000),
    headers: { "User-Agent": "LaPizarra-Alertas-Poller/1.0", ...(opts.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
  return res.json()
}

// ─── Fetchers de fuente (una vez por corrida, con memoización) ───────────────

const cache = {}

async function getDolares() {
  if (!cache.dolares) cache.dolares = await fetchJson(`${APP_URL}/api/dolares`)
  return cache.dolares
}
async function getBcraPlazoFijo() {
  if (!cache.bcra) cache.bcra = await fetchJson(`${APP_URL}/api/bcra?endpoint=plazofijo`)
  return cache.bcra
}
async function getMacroIpc() {
  if (!cache.ipc) cache.ipc = await fetchJson(`${APP_URL}/api/macro?endpoint=ipc`)
  return cache.ipc
}

// ─── Evaluadores por tipo ────────────────────────────────────────────────────

async function evaluar(alerta) {
  const config = alerta.config

  if (alerta.tipo === "dolar") {
    const data = await getDolares()
    const rate = data?.rates?.[config.variedad]
    if (!rate || typeof rate.venta !== "number") {
      return { disparo: false, motivo: `variedad ${config.variedad} no disponible en /api/dolares` }
    }
    const dispara = comparar(config.operador, rate.venta, config.umbral)
    return {
      disparo: dispara,
      detalle: `El ${NOMBRE_VARIEDAD[config.variedad] ?? config.variedad} cotiza a $${rate.venta.toLocaleString("es-AR")} (venta). Tu umbral era ${config.operador} $${Number(config.umbral).toLocaleString("es-AR")}.`,
      valor: rate.venta,
    }
  }

  if (alerta.tipo === "tasa_bcra") {
    const data = await getBcraPlazoFijo()
    const serie = data?.data?.tpm ?? []
    const ultimo = serie[serie.length - 1]
    if (!ultimo || typeof ultimo.valor !== "number") {
      return { disparo: false, motivo: "TPM no disponible en /api/bcra" }
    }
    const dispara = comparar(config.operador, ultimo.valor, config.umbral)
    return {
      disparo: dispara,
      detalle: `La Tasa de Política Monetaria del BCRA está en ${ultimo.valor}% TNA (dato ${ultimo.fecha}). Tu umbral era ${config.operador} ${config.umbral}%.`,
      valor: ultimo.valor,
    }
  }

  if (alerta.tipo === "publicacion_ipc") {
    const data = await getMacroIpc()
    const serie = data?.data?.ipc_general ?? []
    const ultimo = serie[serie.length - 1]
    if (!Array.isArray(ultimo) || !ultimo[0]) {
      return { disparo: false, motivo: "serie IPC vacía" }
    }
    const fechaSerie = new Date(ultimo[0] + "T00:00:00Z")
    // Dispara si el último dato de la serie es más nuevo que el ultimoDisparo
    // (o si nunca disparó y hay al menos un dato).
    const ultimoDisparo = alerta.ultimoDisparo ? new Date(alerta.ultimoDisparo) : null
    const dispara = !ultimoDisparo || fechaSerie > ultimoDisparo
    return {
      disparo: dispara,
      detalle: `INDEC publicó el IPC de ${ultimo[0]}. Ya podés verlo en La Pizarra.`,
      valor: ultimo[1],
      fechaSerie,
    }
  }

  return { disparo: false, motivo: `tipo desconocido: ${alerta.tipo}` }
}

// ─── Envío email vía Resend ──────────────────────────────────────────────────

function renderHtml(descripcion, detalle) {
  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;background:#121214;font-family:system-ui,sans-serif;color:#F5F3EE;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#121214;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
             style="max-width:560px;background:#1A1A1D;border:1px solid #2A2A2F;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:20px 28px;background:#E8944A;color:#0a0a0a;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;opacity:0.75;">La Pizarra · Alerta</div>
          <div style="font-size:20px;font-weight:800;margin-top:6px;">${escapeHtml(descripcion)}</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${escapeHtml(detalle)}</p>
          <p style="margin:0 0 24px;font-size:13px;color:#A8A49D;line-height:1.5;">
            Esta alerta pasó a estado <b style="color:#F5F3EE;">disparada</b>.
            Para volver a recibirla, reactivala desde tu panel de alertas.
          </p>
          <p style="margin:0;"><a href="${DASHBOARD_URL}/alertas"
             style="display:inline-block;padding:12px 20px;background:#E8944A;color:#0a0a0a;text-decoration:none;border-radius:4px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
             Ver en La Pizarra</a></p>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #2A2A2F;font-size:11px;color:#A8A49D;text-align:center;">
          Recibís este mail porque configuraste una alerta en La Pizarra.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

async function enviarEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.log(`  [dry-run] enviaría email a ${to}: ${subject}`)
    return { ok: true, dryRun: true }
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.error(`  [resend] falló status ${res.status}: ${body}`)
    return { ok: false }
  }
  return { ok: true }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const inicio = Date.now()
  console.log(`[poll-alertas] arrancando ${new Date().toISOString()} — APP_URL=${APP_URL}`)

  const alertas = await prisma.alerta.findMany({ where: { estado: "activa" } })
  console.log(`[poll-alertas] ${alertas.length} alertas activas para evaluar`)

  let disparadas = 0
  let evaluadas = 0
  let errores = 0

  for (const alerta of alertas) {
    evaluadas++
    const descripcion = describir(alerta.tipo, alerta.config)
    try {
      const r = await evaluar(alerta)
      if (!r.disparo) {
        console.log(`  ▸ ${alerta.id} (${descripcion}) — no dispara${r.motivo ? ` [${r.motivo}]` : ""}`)
        continue
      }

      console.log(`  ✓ ${alerta.id} (${descripcion}) — DISPARA → ${alerta.emailDestino}`)
      const enviado = await enviarEmail(alerta.emailDestino, `La Pizarra · ${descripcion}`, renderHtml(descripcion, r.detalle))

      if (enviado.ok) {
        disparadas++
        await prisma.alerta.update({
          where: { id: alerta.id },
          data: { estado: "disparada", ultimoDisparo: new Date() },
        })
      } else {
        errores++
      }
    } catch (e) {
      errores++
      console.error(`  ✗ ${alerta.id} — error:`, e instanceof Error ? e.message : e)
    }
  }

  const dur = ((Date.now() - inicio) / 1000).toFixed(1)
  console.log(`[poll-alertas] listo en ${dur}s — evaluadas=${evaluadas} disparadas=${disparadas} errores=${errores}`)
}

main()
  .catch((e) => {
    console.error("[poll-alertas] fatal:", e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
