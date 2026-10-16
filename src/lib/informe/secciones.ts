/**
 * Mapa declarativo del informe semanal: sección -> gráfico -> endpoint -> fuente.
 *
 * Es el molde del semanal de 5 páginas (formato 1816) con NUESTROS datos.
 * Cada gráfico declara:
 *   - de qué endpoint de src/app/api sale (solo endpoints que existen en main),
 *   - qué fuenteId del registro (src/server/sources/registry.ts) lo respalda,
 *   - si está DISPONIBLE o PENDIENTE (todavía no está en main) y, si está
 *     pendiente, con qué rama entra.
 *
 * Cuando una rama se mergea, se cambia UNA entrada: estado "pendiente" ->
 * "disponible", se completan `endpoint` y `extractor` (y se agrega el extractor
 * en extractores.ts), y listo. Nunca hay datos de ejemplo: un gráfico pendiente
 * se muestra como un recuadro vacío y explícito.
 *
 * tests/informe-secciones.test.ts verifica que cada entrada disponible apunte a
 * un endpoint real y a un fuenteId real del registro.
 */

/** Ids de sección: son los encabezados `## <id>` del markdown editorial. */
export type SeccionId = "deuda-usd" | "credito" | "deuda-pesos" | "tipo-de-cambio" | "reservas"

/** Nombre de la función de src/lib/informe/extractores.ts que arma el gráfico. */
export type ExtractorId =
  | "riesgo_pais"
  | "globales_tir"
  | "deuda_pib"
  | "depositos"
  | "tasas_depositos"
  | "lecap_curva"
  | "cer_duales"
  | "licitaciones"
  | "tc_historico"
  | "bandas"
  | "reservas"
  | "compras_bcra"

export interface GraficoDef {
  id: string
  titulo: string
  estado: "disponible" | "pendiente"
  /** Ruta + query del endpoint propio, ej. "/api/bcra?endpoint=reservas". Obligatorio si está disponible. */
  endpoint?: string
  extractor?: ExtractorId
  /** Clave de SOURCE_REGISTRY. Obligatorio si está disponible; en pendientes, la fuente prevista. */
  fuenteId?: string
  /** Rama donde vive el dato que falta. Obligatorio si está pendiente. */
  rama?: string
  /** Aclaración corta que se imprime al pie (límites del dato, rama que agrega columnas, etc.). */
  nota?: string
}

export interface SeccionDef {
  id: SeccionId
  titulo: string
  /** Posición por volumen de gráficos en 1816 (1 = el tema más frecuente). */
  rankingTema: number
  graficos: GraficoDef[]
}

export const SECCIONES: SeccionDef[] = [
  {
    id: "deuda-usd",
    titulo: "Deuda en dólares y riesgo país",
    rankingTema: 1,
    graficos: [
      {
        id: "riesgo-pais",
        titulo: "Riesgo país (EMBI+, puntos básicos)",
        estado: "disponible",
        endpoint: "/api/riesgo-pais",
        extractor: "riesgo_pais",
        fuenteId: "argentina_datos",
      },
      {
        id: "globales-tir",
        titulo: "TIR de los Globales (Ley NY)",
        estado: "disponible",
        endpoint: "/api/riesgo-pais",
        extractor: "globales_tir",
        fuenteId: "byma_data_open",
        nota: "TIR calculada en vivo con precio BYMA; la fuente no informa fecha de precio, se muestra la fecha de consulta.",
      },
      {
        id: "deuda-pib",
        titulo: "Deuda pública bruta (% del PIB)",
        estado: "disponible",
        endpoint: "/api/deuda?endpoint=stock",
        extractor: "deuda_pib",
        fuenteId: "argentina_gob",
        nota: "Stock de la Secretaría de Finanzas sobre PIB en USD de INDEC (datos.gob.ar, serie trimestral).",
      },
    ],
  },
  {
    id: "credito",
    titulo: "Crédito, depósitos y morosidad",
    rankingTema: 2,
    graficos: [
      {
        id: "depositos",
        titulo: "Depósitos del sector privado (billones de ARS)",
        estado: "disponible",
        endpoint: "/api/bcra?endpoint=agregados",
        extractor: "depositos",
        fuenteId: "bcra_official",
        nota: "Unidad tomada del catálogo del endpoint (millones de ARS) y mostrada en billones; [a verificar] contra la serie oficial.",
      },
      {
        id: "tasas-depositos",
        titulo: "Tasas de depósitos: TAMAR, BADLAR y plazo fijo 30d (TNA %)",
        estado: "disponible",
        endpoint: "/api/bcra?endpoint=tasas",
        extractor: "tasas_depositos",
        fuenteId: "bcra_official",
      },
      {
        id: "morosidad",
        titulo: "Morosidad y calidad de cartera",
        estado: "pendiente",
        fuenteId: "bcra_files",
        rama: "feat/bcra-morosidad-y-anexo",
      },
    ],
  },
  {
    id: "deuda-pesos",
    titulo: "Deuda en pesos: LECAP, CER y duales",
    rankingTema: 3,
    graficos: [
      {
        id: "lecap",
        titulo: "Curva LECAP / BONCAP",
        estado: "disponible",
        endpoint: "/api/bonos?tipo=lecap",
        extractor: "lecap_curva",
        fuenteId: "byma_data_open",
      },
      {
        id: "cer-duales",
        titulo: "Bonos CER y duales: TIR y paridad",
        estado: "disponible",
        endpoint: "/api/bonos?tipo=pesos",
        extractor: "cer_duales",
        fuenteId: "byma_data_open",
        nota: "TIR y paridad vienen de Rava y solo se muestran si su fecha es fresca; si no, la celda queda vacía.",
      },
      {
        id: "licitaciones",
        titulo: "Últimas licitaciones del Tesoro: ofertado vs adjudicado",
        estado: "disponible",
        endpoint: "/api/deuda",
        extractor: "licitaciones",
        fuenteId: "argentina_gob",
        nota: "Cobertura = ofertado / adjudicado. La columna de rollover (adjudicado / vencimientos) entra con la rama feat/licitaciones-rollover.",
      },
      {
        id: "dollar-linked",
        titulo: "Volumen operado en dollar-linked",
        estado: "pendiente",
        fuenteId: "byma_data_open",
        rama: "feat/bonos-dollar-linked",
      },
    ],
  },
  {
    id: "tipo-de-cambio",
    titulo: "Tipo de cambio y cobertura",
    rankingTema: 4,
    graficos: [
      {
        id: "tc-historico",
        titulo: "Tipos de cambio: oficial, MEP, CCL y blue (ARS por USD)",
        estado: "disponible",
        endpoint: "/api/tc-historico?period=1y",
        extractor: "tc_historico",
        fuenteId: "argentina_datos",
      },
      {
        id: "bandas",
        titulo: "Bandas cambiarias: piso y techo (ARS por USD)",
        estado: "disponible",
        endpoint: "/api/bcra-bands",
        extractor: "bandas",
        fuenteId: "datos_gob_series",
        nota: "Los puntos posteriores a la fecha de corte son proyección de la regla de bandas, no dato observado; se excluyen del gráfico.",
      },
      {
        id: "balance-cambiario",
        titulo: "Balance cambiario (flujos del MULC)",
        estado: "pendiente",
        fuenteId: "bcra_files",
        rama: "feat/fuente-balance-cambiario",
      },
    ],
  },
  {
    id: "reservas",
    titulo: "Reservas y compras del BCRA",
    rankingTema: 5,
    graficos: [
      {
        id: "reservas",
        titulo: "Reservas internacionales brutas y netas (USD millones)",
        estado: "disponible",
        endpoint: "/api/bcra?endpoint=reservas",
        extractor: "reservas",
        fuenteId: "bcra_official",
      },
      {
        id: "compras",
        titulo: "Compras de divisas del BCRA, últimos 30 días hábiles (USD millones)",
        estado: "disponible",
        endpoint: "/api/bcra?endpoint=compras",
        extractor: "compras_bcra",
        fuenteId: "bcra_official",
      },
      {
        id: "repo-stock",
        titulo: "Stock REPO vs tasa REPO",
        estado: "pendiente",
        fuenteId: "bcra_official",
        rama: "feat/bcra-repo-stock",
      },
    ],
  },
]

/** "/api/bcra?endpoint=x" -> { ruta: "bcra", query: { endpoint: "x" } }. */
export function descomponerEndpoint(endpoint: string): { ruta: string; query: Record<string, string> } {
  const [pathPart, queryPart = ""] = endpoint.split("?")
  const ruta = pathPart.replace(/^\/api\//, "").replace(/\/+$/, "")
  const query = Object.fromEntries(new URLSearchParams(queryPart).entries())
  return { ruta, query }
}
