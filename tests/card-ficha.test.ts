import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import { DATA_CARD_BY_ID, DATA_CARD_CATALOG, cardsSharingEndpoint } from "../src/lib/card-catalog"
import { CARD_FICHA_META } from "../src/lib/card-ficha-meta"
import { buildFichaView, evaluateFreshness, extractSeries, nextFocusIndex } from "../src/lib/card-ficha"
import { buscarTermino } from "../src/lib/glossary"
import { DATA_CLASS_FRESHNESS, SOURCE_REGISTRY } from "../src/server/sources/registry"

// ── Modelo ───────────────────────────────────────────────────────────────────

test("la metadata de la ficha solo apunta a tarjetas que existen en el catálogo", () => {
  for (const id of Object.keys(CARD_FICHA_META)) assert.ok(DATA_CARD_BY_ID.has(id), `CARD_FICHA_META tiene un id huérfano: ${id}`)
})

test("fuenteId existe en el registry de fuentes", () => {
  for (const card of DATA_CARD_CATALOG) {
    if (card.fuenteId === undefined) continue
    assert.ok(card.fuenteId in SOURCE_REGISTRY, `${card.id}: fuenteId "${card.fuenteId}" no está en SOURCE_REGISTRY`)
  }
})

test("relacionadas apunta a ids existentes, sin duplicados ni autorreferencia", () => {
  for (const card of DATA_CARD_CATALOG) {
    const related = card.relacionadas ?? []
    assert.equal(new Set(related).size, related.length, `${card.id}: relacionadas duplicadas`)
    for (const id of related) {
      assert.notEqual(id, card.id, `${card.id} se relaciona consigo misma`)
      assert.ok(DATA_CARD_BY_ID.has(id), `${card.id}: la relacionada "${id}" no existe`)
    }
  }
})

test("glosario apunta a términos que existen en el glosario", () => {
  for (const card of DATA_CARD_CATALOG) {
    for (const termId of card.glosario ?? []) assert.ok(buscarTermino(termId), `${card.id}: el término "${termId}" no está en GLOSSARY`)
  }
})

test("serieEndpoint usa rutas internas que existen y líneas bien formadas", () => {
  for (const card of DATA_CARD_CATALOG) {
    const spec = card.serieEndpoint
    if (!spec) continue
    assert.match(spec.path, /^\/api\/[a-z0-9-]+(?:\?.*)?$/, `${card.id}: path inválido`)
    const route = spec.path.split("?")[0].replace("/api/", "")
    assert.ok(existsSync(`src/app/api/${route}/route.ts`), `${card.id}: no existe la ruta ${spec.path}`)
    assert.ok(spec.lines.length > 0, `${card.id}: serieEndpoint sin líneas`)
    for (const line of spec.lines) {
      assert.ok(line.path.length > 0 && line.name.length > 0)
      if (line.shape === "objects") assert.ok(line.dateKey && line.valueKey, `${card.id}: línea "${line.name}" sin dateKey/valueKey`)
    }
    // Sin fuente declarada no se puede atribuir ni juzgar frescura: es obligatoria con serie.
    assert.ok(card.fuenteId, `${card.id}: tiene serieEndpoint pero no fuenteId`)
    assert.ok(spec.claseDato && spec.claseDato in DATA_CLASS_FRESHNESS, `${card.id}: falta claseDato válida`)
  }
})

test("el catálogo conserva ids únicos tras mezclar la metadata", () => {
  assert.equal(new Set(DATA_CARD_CATALOG.map((card) => card.id)).size, DATA_CARD_CATALOG.length)
})

test("cobertura: hay tarjetas con ficha completa (fuente + cálculo + serie) y el resto queda vacío, no inventado", () => {
  const completas = DATA_CARD_CATALOG.filter((card) => card.fuenteId && card.calculo && card.serieEndpoint).map((card) => card.id)
  assert.ok(completas.length >= 10, `solo ${completas.length} tarjetas con ficha completa`)
  for (const id of ["resumen-tipo-cambio", "fx", "riesgo-pais", "ipc", "emae", "bcra-reservas", "bcra-tasas"]) assert.ok(completas.includes(id), `${id} debería tener ficha completa`)
  // Estas no tienen fórmula verificable en el código: tienen que seguir sin 'calculo'.
  for (const id of ["acciones", "big-mac", "balanza", "deuda-publica", "desigualdad", "piramides"]) assert.equal(DATA_CARD_BY_ID.get(id)?.calculo, undefined, `${id} no debería tener calculo sin verificar`)
})

// ── Relaciones derivadas ─────────────────────────────────────────────────────

test("las tarjetas que consumen el mismo endpoint se derivan solas", () => {
  assert.ok(cardsSharingEndpoint("resumen-ipc").some((card) => card.id === "ipc"))
  assert.ok(cardsSharingEndpoint("ipc").some((card) => card.id === "resumen-ipc"))
  assert.ok(cardsSharingEndpoint("riesgo-pais").some((card) => card.id === "resumen-riesgo"))
  assert.ok(cardsSharingEndpoint("bonos").some((card) => card.id === "screener-activos"))
  assert.deepEqual(cardsSharingEndpoint("no-existe"), [])
  assert.ok(!cardsSharingEndpoint("ipc").some((card) => card.id === "ipc"))
})

test("buildFichaView arma fuente, glosario y relaciones sin repetir tarjetas", () => {
  const view = buildFichaView("ipc")
  assert.ok(view)
  assert.equal(view.source?.id, "datos_gob_series")
  assert.equal(view.source?.publisher, "datos.gob.ar")
  assert.ok(view.glossary.some((term) => term.id === "IPC"))
  assert.ok(view.comparten.some((card) => card.id === "resumen-ipc"))
  const ids = [...view.comparten, ...view.relacionadas].map((card) => card.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(view.relacionadas.some((card) => card.id === "senoraje"))
  assert.equal(buildFichaView("no-existe"), null)
  // Una tarjeta sin metadata no inventa fuente.
  assert.equal(buildFichaView("acciones")?.source, null)
})

test("la relación se puede recorrer: de la base monetaria al señoreaje y de vuelta", () => {
  assert.ok(buildFichaView("bcra-agregados")?.relacionadas.some((card) => card.id === "senoraje"))
  assert.ok(buildFichaView("senoraje")?.relacionadas.some((card) => card.id === "bcra-agregados"))
})

// ── Extracción de la serie ───────────────────────────────────────────────────

test("extractSeries lee tuplas, aplica scale y ordena de vieja a nueva", () => {
  const payload = { data: { ipc_var_mensual: [["2026-03-01", 0.03], ["2026-01-01", 0.02], ["2026-02-01", null]] } }
  const series = extractSeries(payload, { path: "/api/macro?endpoint=ipc", lines: [{ path: "data.ipc_var_mensual", name: "Mensual", shape: "tuples", scale: 100 }] })
  assert.deepEqual(series.rows.map((row) => [row.date, row.l0]), [["2026-01-01", 2], ["2026-03-01", 3]])
  assert.equal(series.lastDate, "2026-03-01")
  assert.equal(series.points, 2)
})

test("extractSeries une líneas por fecha y descarta nulos, texto y fechas inválidas", () => {
  const payload = {
    data: [
      { date: "2026-01-01", blue: 1000, mep: null },
      { date: "2026-01-02", blue: 1010, mep: 1005 },
      { date: "no-es-fecha", blue: 5, mep: 5 },
      { date: "2026-01-03", blue: "x", mep: 1007 },
    ],
  }
  const series = extractSeries(payload, {
    path: "/api/tc-historico",
    lines: [
      { path: "data", name: "Blue", shape: "objects", dateKey: "date", valueKey: "blue" },
      { path: "data", name: "MEP", shape: "objects", dateKey: "date", valueKey: "mep" },
    ],
  })
  assert.equal(series.rows.length, 3)
  assert.deepEqual(series.rows[1], { date: "2026-01-02", l0: 1010, l1: 1005 })
  assert.equal(series.rows[0].l1, undefined)
  assert.equal(series.lastDate, "2026-01-03")
})

test("extractSeries adelgaza series largas pero conserva el último punto", () => {
  const data = Array.from({ length: 5000 }, (_, index) => ({ fecha: new Date(Date.UTC(2010, 0, 1 + index)).toISOString().slice(0, 10), valor: index }))
  const series = extractSeries({ data }, { path: "/x", lines: [{ path: "data", name: "S", shape: "objects", dateKey: "fecha", valueKey: "valor" }] }, 1000)
  assert.ok(series.rows.length <= 1001)
  assert.equal(series.rows.at(-1)?.l0, 4999)
  assert.equal(series.points, 5000)
})

test("extractSeries tolera payloads sin la ruta esperada", () => {
  const series = extractSeries({ error: "boom" }, { path: "/x", lines: [{ path: "data.historico", name: "S", shape: "objects", dateKey: "date", valueKey: "valor" }] })
  assert.equal(series.rows.length, 0)
  assert.equal(series.lastDate, null)
})

// ── Frescura ─────────────────────────────────────────────────────────────────

const DAY = 86_400_000
const now = Date.parse("2026-10-15T12:00:00Z")

test("frescura diaria: al día, con demora y vencida según las ventanas del registry", () => {
  assert.equal(evaluateFreshness({ lastDate: "2026-10-15", claseDato: "official_daily", now }).state, "al_dia")
  assert.equal(evaluateFreshness({ lastDate: "2026-10-12", claseDato: "official_daily", now }).state, "con_demora")
  assert.equal(evaluateFreshness({ lastDate: "2026-10-01", claseDato: "official_daily", now }).state, "vencido")
  assert.ok(now - Date.parse("2026-10-01T00:00:00Z") > (DATA_CLASS_FRESHNESS.official_daily.rejectAfterSeconds * 1000))
})

test("frescura mensual usa la ventana mensual, no la diaria de la fuente", () => {
  // datos_gob_series es 'official_daily' en el registry; una serie mensual de hace 40 días no debe marcarse vencida.
  assert.equal(evaluateFreshness({ lastDate: "2026-09", claseDato: "official_monthly", sourceId: "datos_gob_series", now }).state, "al_dia")
  assert.notEqual(evaluateFreshness({ lastDate: "2026-09", sourceId: "datos_gob_series", now }).state, "al_dia")
})

test("frescura: fuente caída, datos de respaldo y serie sin fechas", () => {
  assert.equal(evaluateFreshness({ lastDate: null, fetchFailed: true }).state, "caida")
  assert.equal(evaluateFreshness({ lastDate: "2026-10-15", stalePayload: true, now }).state, "respaldo")
  assert.equal(evaluateFreshness({ lastDate: null, now }).state, "sin_dato")
  assert.equal(evaluateFreshness({ lastDate: "basura", now }).state, "sin_dato")
})

// ── Trampa de foco ───────────────────────────────────────────────────────────

test("nextFocusIndex cicla el foco dentro del panel", () => {
  assert.equal(nextFocusIndex(0, -1, false), null)
  assert.equal(nextFocusIndex(4, 3, false), 0)
  assert.equal(nextFocusIndex(4, 0, true), 3)
  assert.equal(nextFocusIndex(4, 1, false), null)
  assert.equal(nextFocusIndex(4, 2, true), null)
  assert.equal(nextFocusIndex(4, -1, false), 0)
  assert.equal(nextFocusIndex(4, -1, true), 3)
})

// ── Contrato del componente (no hay jsdom en el repo: se valida el fuente) ───

test("CardFicha declara el contrato de accesibilidad y está conectada al Canvas", () => {
  const ficha = readFileSync("src/client/components/workspace/card-ficha.tsx", "utf8")
  assert.match(ficha, /role="dialog"/)
  assert.match(ficha, /aria-modal="true"/)
  assert.match(ficha, /aria-labelledby=\{titleId\}/)
  assert.match(ficha, /event\.key === "Escape"/)
  assert.match(ficha, /nextFocusIndex/)
  assert.match(ficha, /createPortal/)
  assert.match(ficha, /BBGLineChart/)
  assert.match(ficha, /openRelated/)
  assert.doesNotMatch(ficha, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, "sin emojis")

  const canvas = readFileSync("src/client/components/workspace/canvas-workspace.tsx", "utf8")
  assert.match(canvas, /<CardFicha cardId=\{fichaCardId\}/)
  assert.match(canvas, /Abrir ficha de/)
})
