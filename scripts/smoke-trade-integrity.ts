import { NextRequest } from "next/server"
import { GET as getPartners } from "../src/app/api/balanza-socios/route"
import { GET as getMacro } from "../src/app/api/macro/route"
import { GET as getRetiredMap } from "../src/app/api/balanza-map/route"
import { tradeBalanceMatches } from "../src/lib/trade-data"

async function main() {
  const partnersResponse = await getPartners()
  const partners = await partnersResponse.json()
  if (partnersResponse.status !== 200) throw new Error(`partners status ${partnersResponse.status}`)
  if (partners.data?.live_count !== 10) throw new Error(`expected 10 live partners, got ${partners.data?.live_count}`)
  if (partners.data?.is_live_importaciones !== false) throw new Error("imports must remain explicitly unavailable")

  const macroResponse = await getMacro(new NextRequest("http://localhost/api/macro?endpoint=balanza"))
  const macro = await macroResponse.json()
  const expo = macro.data?.exportaciones?.[0]?.[1]
  const impo = macro.data?.importaciones?.[0]?.[1]
  const saldo = macro.data?.saldo_comercial?.[0]?.[1]
  if (![expo, impo, saldo].every(Number.isFinite) || !tradeBalanceMatches(expo, impo, saldo)) {
    throw new Error(`trade identity failed: ${expo} - ${impo} != ${saldo}`)
  }

  const defaultResponse = await getMacro(new NextRequest("http://localhost/api/macro?endpoint=emae_sectorial"))
  const allResponse = await getMacro(new NextRequest("http://localhost/api/macro?endpoint=emae_sectorial&months=all"))
  const defaultPayload = await defaultResponse.json()
  const allPayload = await allResponse.json()
  if (defaultPayload.data?.length !== 25) throw new Error(`default sectorial length ${defaultPayload.data?.length}`)
  if (!(allPayload.data?.length > defaultPayload.data.length)) throw new Error("months=all did not expand sectorial range")

  const retired = await getRetiredMap()
  if (retired.status !== 410) throw new Error(`retired map status ${retired.status}`)

  console.log(JSON.stringify({
    partners: { status: partnersResponse.status, liveCount: partners.data.live_count, year: partners.data.anio_referencia, importsLive: partners.data.is_live_importaciones },
    trade: { status: macroResponse.status, date: macro.data.exportaciones[0][0], expo, impo, saldo, reconciled: true },
    sectorial: { default: defaultPayload.data.length, all: allPayload.data.length },
    retiredMap: retired.status,
  }, null, 2))
}

main().catch((error) => { console.error(error); process.exit(1) })
