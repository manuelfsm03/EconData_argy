import { NextResponse } from "next/server"
import { bcraOfficialApi } from "@/lib/bcra-official-api"

// Endpoint siempre dinámico: sirve el último dato publicado por el BCRA.
export const dynamic = "force-dynamic"

/**
 * BCRA Balance / Principales variables
 * ---------------------------------------------------------------------------
 * Descubre DINÁMICAMENTE todo el catálogo de variables monetarias del BCRA
 * (API v4.0, endpoint `monetarias` SIN id) y devuelve el último valor + fecha
 * de cada una. Cero IDs y cero valores hardcodeados: si el BCRA agrega o
 * cambia variables, aparecen solas. Lo único configurable son las REGLAS de
 * agrupación por familia (keywords), no los datos.
 */

// ── Reglas de agrupación por familia (CONFIGURABLE, no son datos) ─────────────
// Se evalúan en orden: la PRIMERA familia cuya keyword matchee gana.
// Las keywords se comparan sobre la descripción normalizada (sin acentos,
// minúsculas) y con límites de palabra, así "cer" no matchea dentro de
// "referencia". Si ninguna matchea, la variable cae en "otras".
type ReglaFamilia = { familia: string; label: string; keywords: string[] }

const FAMILIAS: ReglaFamilia[] = [
  {
    familia: "tasas",
    label: "Tasas de interés",
    keywords: ["tasa", "badlar", "tm20", "tamar", "baibar", "cer", "uva", "uvi"],
  },
  {
    familia: "reservas",
    label: "Reservas internacionales",
    keywords: ["reservas"],
  },
  {
    familia: "base_monetaria",
    label: "Base monetaria",
    keywords: ["base monetaria"],
  },
  {
    familia: "pasivos_bcra",
    label: "Pasivos remunerados del BCRA",
    keywords: [
      "pases",
      "leliq",
      "lefi",
      "lebac",
      "nobac",
      "letras",
      "pasivos del bcra",
      "pasivos remunerados",
    ],
  },
  {
    familia: "tipo_cambio",
    label: "Tipo de cambio",
    keywords: ["tipo de cambio", "bandas cambiarias", "por dolar"],
  },
  {
    familia: "inflacion_indices",
    label: "Inflación e índices",
    keywords: [
      "inflacion",
      "precios",
      "coeficiente de estabilizacion",
      "unidad de valor",
      "unidad de vivienda",
      "indice",
      "locacion",
      "expectativa",
    ],
  },
  {
    familia: "depositos",
    label: "Depósitos",
    keywords: [
      "deposito",
      "depositos",
      "caja de ahorro",
      "cajas de ahorro",
      "plazo fijo",
      "cuenta corriente",
      "cedro",
    ],
  },
  {
    familia: "prestamos",
    label: "Préstamos y financiaciones",
    keywords: [
      "prestamo",
      "prestamos",
      "adelanto",
      "credito",
      "financiacion",
      "hipotecario",
      "prendario",
      "documentos",
      "tarjeta",
    ],
  },
  {
    familia: "circulacion",
    label: "Circulación y agregados",
    keywords: [
      "circulacion",
      "billetes y monedas",
      "efectivo",
      "agregado",
      "medios de pago",
      "m2",
      "m3",
    ],
  },
]

const FAMILIA_OTRAS = { familia: "otras", label: "Otras variables" }

// ── Cache en memoria (10 min) ─────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; expiry: number }>()
const CACHE_KEY = "bcra_balance"
const CACHE_TTL_SECONDS = 600 // 10 minutos

function getCache(key: string): unknown | null {
  const e = cache.get(key)
  if (e && Date.now() < e.expiry) return e.data
  return null
}
function setCache(key: string, data: unknown, ttlSeconds: number) {
  cache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 })
}

// ── Normalización de texto para el matcheo de keywords ────────────────────────
// Pasa a minúsculas y saca acentos/diacríticos (y de paso neutraliza los
// caracteres corruptos que a veces trae el BCRA en las descripciones).
function normalizar(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca diacríticos combinantes
    .toLowerCase()
}

// Escapa una keyword para usarla dentro de un RegExp.
function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Devuelve la familia derivada de la descripción (primera que matchee).
function clasificarFamilia(descripcion: string): { familia: string; label: string } {
  const texto = normalizar(descripcion)
  for (const regla of FAMILIAS) {
    for (const kw of regla.keywords) {
      // \b...\b => match por palabra completa, evita falsos positivos.
      const re = new RegExp(`\\b${escaparRegex(normalizar(kw))}\\b`)
      if (re.test(texto)) {
        return { familia: regla.familia, label: regla.label }
      }
    }
  }
  return FAMILIA_OTRAS
}

// ── Tipos de salida ───────────────────────────────────────────────────────────
interface VariableBalance {
  id: number
  descripcion: string
  categoria: string // categoría propia del BCRA (informativa)
  periodicidad: string
  valor: number
  fecha: string // fecha del último dato de esa variable
  unidad: string
  moneda: string
  familia: string // familia DERIVADA por nuestras reglas
}

// ── Descubrimiento dinámico del catálogo completo (paginado) ──────────────────
async function traerCatalogoCompleto(): Promise<VariableBalance[]> {
  const PAGE_SIZE = 1000 // tamaño de página (paginación, no es un dato)
  const todas: VariableBalance[] = []
  let offset = 0

  // Paginamos hasta que una página venga incompleta (fin del catálogo).
  // Escalable: no dependemos de un total conocido de antemano.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pagina = await bcraOfficialApi.getVariables({ limit: PAGE_SIZE, offset })
    for (const v of pagina) {
      const { familia } = clasificarFamilia(v.descripcion)
      todas.push({
        id: v.idVariable,
        descripcion: v.descripcion,
        categoria: v.categoria,
        periodicidad: v.periodicidad,
        valor: v.ultValorInformado,
        fecha: v.ultFechaInformada,
        unidad: v.unidadExpresion,
        moneda: v.moneda,
        familia,
      })
    }
    if (pagina.length < PAGE_SIZE) break // última página
    offset += PAGE_SIZE
    if (offset > 100_000) break // guarda anti-loop infinito (defensivo)
  }

  return todas
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET() {
  const fetchedAt = new Date().toISOString()

  // 1) Cache
  const cached = getCache(CACHE_KEY)
  if (cached) return NextResponse.json(cached)

  try {
    // 2) Traer catálogo completo dinámicamente
    const variables = await traerCatalogoCompleto()

    if (variables.length === 0) {
      // La API respondió pero sin variables: lo tratamos como error honesto,
      // nunca inventamos datos.
      const payload = {
        status: "error" as const,
        message: "fuente no conectada",
        source: "BCRA API v4.0",
        fetched_at: fetchedAt,
        data_date: null,
        fallback_used: false,
        count: 0,
        variables: [] as VariableBalance[],
        familias: [] as unknown[],
      }
      return NextResponse.json(payload, { status: 502 })
    }

    // 3) Fecha del último dato del catálogo (máx. de todas las variables)
    const dataDate = variables.reduce(
      (max, v) => (v.fecha && v.fecha > max ? v.fecha : max),
      ""
    )

    // 4) Resumen por familia (derivado), en el orden de las reglas + "otras"
    const ordenFamilias = [...FAMILIAS.map((f) => f.familia), FAMILIA_OTRAS.familia]
    const labelPorFamilia: Record<string, string> = {
      ...Object.fromEntries(FAMILIAS.map((f) => [f.familia, f.label])),
      [FAMILIA_OTRAS.familia]: FAMILIA_OTRAS.label,
    }

    const grupos = ordenFamilias
      .map((familia) => {
        const vars = variables.filter((v) => v.familia === familia)
        return {
          familia,
          label: labelPorFamilia[familia],
          count: vars.length,
          variables: vars,
        }
      })
      .filter((g) => g.count > 0) // no mostramos familias vacías

    // 5) Payload con provenance honesto
    const payload = {
      status: "ok" as const,
      source: "BCRA API v4.0",
      fetched_at: fetchedAt,
      data_date: dataDate || null,
      fallback_used: false,
      count: variables.length,
      variables, // lista plana con TODAS las variables (cada una con su familia)
      familias: grupos, // agrupación derivada por familia
    }

    setCache(CACHE_KEY, payload, CACHE_TTL_SECONDS)
    return NextResponse.json(payload)
  } catch (err) {
    // La API falló: status error + array vacío + "fuente no conectada".
    // Nada de valores inventados ni fallback silencioso.
    console.error("BCRA balance error:", err)
    return NextResponse.json(
      {
        status: "error" as const,
        message: "fuente no conectada",
        source: "BCRA API v4.0",
        fetched_at: fetchedAt,
        data_date: null,
        fallback_used: false,
        count: 0,
        variables: [] as VariableBalance[],
        familias: [] as unknown[],
      },
      { status: 502 }
    )
  }
}
