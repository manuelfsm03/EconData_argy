import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  agregarPorCampania,
  catalogoCultivos,
  claveSerie,
  construirIndice,
  discontinuidadesDe,
  normalizarClave,
  parseSiiaCsv,
  SIIA_DISCONTINUIDADES,
  splitCsvLine,
} from "../src/server/external/siia-estimaciones"
import { SOURCE_REGISTRY } from "../src/server/sources/registry"

const route = readFileSync("src/app/api/agro-produccion/route.ts", "utf8")

// Muestra con la forma exacta del CSV del SIIA: encabezado entrecomillado,
// texto entre comillas y numéricos sin comillas.
const CSV = [
  '"cultivo","anio","campania","provincia","provincia_id","departamento","departamento_id","superficie_sembrada_ha","superficie_cosechada_ha","produccion_tm","rendimiento_kgxha"',
  '"soja total","2022","2022/2023","Buenos Aires","06","25 de Mayo","06854",1000,900,2700,3000',
  '"soja total","2022","2022/2023","Buenos Aires","06","Pergamino","06588",500,500,2000,4000',
  '"soja total","2022","2022/2023","Córdoba","14","Río Cuarto","14098",2000,1000,1000,1000',
  '"soja total","2023","2023/2024","Buenos Aires","06","Pergamino","06588",600,600,3000,5000',
  '"cebada forrajera","2015","2015/2016","Buenos Aires","06","Tandil","06805",100,100,400,4000',
  '"cebada total","2016","2016/2017","Buenos Aires","06","Tandil","06805",120,120,500,4167',
].join("\n")

test("parsea el CSV del SIIA respetando comillas y tipos", () => {
  const rows = parseSiiaCsv(CSV)
  assert.equal(rows.length, 6)

  const primera = rows[0]
  assert.equal(primera.cultivo, "soja total")
  assert.equal(primera.anio, 2022)
  assert.equal(primera.campania, "2022/2023")
  assert.equal(primera.departamento, "25 de Mayo")
  assert.equal(primera.departamentoId, "06854")
  assert.equal(primera.superficieSembradaHa, 1000)
  assert.equal(primera.produccionTm, 2700)
})

test("splitCsvLine respeta comas dentro de comillas y comillas escapadas", () => {
  assert.deepEqual(splitCsvLine('"a,b",1,"c"'), ["a,b", "1", "c"])
  assert.deepEqual(splitCsvLine('"di""jo",2'), ['di"jo', "2"])
})

test("celdas vacías o SD se leen como null, no como cero", () => {
  const rows = parseSiiaCsv([
    '"cultivo","anio","campania","provincia","provincia_id","departamento","departamento_id","superficie_sembrada_ha","superficie_cosechada_ha","produccion_tm","rendimiento_kgxha"',
    '"maíz","2020","2020/2021","Salta","66","Anta","66007",100,,SD,',
  ].join("\n"))

  assert.equal(rows[0].superficieSembradaHa, 100)
  assert.equal(rows[0].superficieCosechadaHa, null)
  assert.equal(rows[0].produccionTm, null)
  assert.equal(rows[0].rendimientoKgHa, null)
})

test("el rendimiento agregado se pondera por superficie, no se promedia", () => {
  const rows = parseSiiaCsv(CSV)
  const serie = agregarPorCampania(rows, { cultivo: "soja total" })
  const campania2022 = serie.find((punto) => punto.campania === "2022/2023")
  assert.ok(campania2022)

  // 5700 tn sobre 2400 ha cosechadas = 2375 kg/ha.
  // El promedio simple de 3000, 4000 y 1000 daría 2667: sobreestimaría el
  // rendimiento dándole a Río Cuarto el mismo peso que a Pergamino.
  assert.equal(campania2022.produccionTm, 5700)
  assert.equal(campania2022.superficieCosechadaHa, 2400)
  assert.equal(campania2022.rendimientoKgHa, 2375)
  assert.equal(campania2022.unidadesReportadas, 3)
})

test("el filtro por provincia recorta el agregado", () => {
  const rows = parseSiiaCsv(CSV)
  const serie = agregarPorCampania(rows, { cultivo: "soja total", provincia: "Córdoba" })
  assert.equal(serie.length, 1)
  assert.equal(serie[0].produccionTm, 1000)
})

test("el filtro de cultivo y provincia ignora acentos y mayúsculas", () => {
  const rows = parseSiiaCsv(CSV)
  assert.equal(normalizarClave("Córdoba"), "cordoba")
  const serie = agregarPorCampania(rows, { cultivo: "SOJA TOTAL", provincia: "cordoba" })
  assert.equal(serie.length, 1)
  assert.equal(serie[0].produccionTm, 1000)
})

test("la serie sale ordenada por año", () => {
  const serie = agregarPorCampania(parseSiiaCsv(CSV), { cultivo: "soja total" })
  assert.deepEqual(serie.map((punto) => punto.anio), [2022, 2023])
})

test("el índice arma serie nacional y provincial en un solo recorrido", () => {
  const indice = construirIndice(parseSiiaCsv(CSV))

  const nacional = indice.series.get(claveSerie("soja total"))
  assert.ok(nacional)
  assert.equal(nacional.length, 2)
  assert.equal(nacional[0].produccionTm, 5700)

  const cordoba = indice.series.get(claveSerie("soja total", "Córdoba"))
  assert.ok(cordoba)
  assert.equal(cordoba[0].produccionTm, 1000)

  assert.deepEqual(indice.provinciasPorCultivo.get("soja total"), ["Buenos Aires", "Córdoba"])
})

test("el catálogo informa la cobertura temporal real de cada cultivo", () => {
  const catalogo = catalogoCultivos(parseSiiaCsv(CSV))
  const soja = catalogo.find((entrada) => entrada.cultivo === "soja total")
  assert.ok(soja)
  assert.equal(soja.desde, 2022)
  assert.equal(soja.hasta, 2023)
  assert.equal(soja.registros, 4)
})

test("la cebada declara su quiebre metodológico de 2016", () => {
  // El caso que Bacchini usó de ejemplo: el desglose forrajera/cervecera existe
  // hasta 2015 y desde 2016 solo hay total. Empalmar sin avisar inventa un salto.
  for (const cultivo of ["cebada forrajera", "cebada cervecera", "cebada total"]) {
    const quiebres = discontinuidadesDe(cultivo)
    assert.equal(quiebres.length, 1, `${cultivo} debería declarar su quiebre`)
    assert.equal(quiebres[0].anio, 2016)
    assert.equal(quiebres[0].tipo, "cambio-metodologico")
  }
})

test("los cítricos quedan marcados como serie discontinuada", () => {
  const quiebres = discontinuidadesDe("naranja")
  assert.equal(quiebres.length, 1)
  assert.equal(quiebres[0].tipo, "serie-discontinuada")
  assert.equal(quiebres[0].anio, 1996)
})

test("un cultivo sin quiebres declarados no inventa advertencias", () => {
  assert.deepEqual(discontinuidadesDe("girasol"), [])
})

test("toda discontinuidad declarada trae nota explicativa", () => {
  for (const entrada of SIIA_DISCONTINUIDADES) {
    assert.ok(entrada.cultivos.length > 0)
    assert.ok(entrada.nota.length > 40, `${entrada.cultivos[0]} necesita una nota que explique el quiebre`)
    assert.ok(Number.isInteger(entrada.anio))
  }
})

test("la fuente del SIIA está registrada con ventana anual y límite acorde al CSV", () => {
  const fuente = SOURCE_REGISTRY.magyp_siia
  assert.equal(fuente.kind, "csv")
  assert.equal(fuente.dataClass, "annual")
  // El CSV ronda los 15 MB: con el límite por defecto de 25 MB queda al filo.
  assert.ok(fuente.maxResponseBytes >= 30 * 1024 * 1024)
  assert.ok(fuente.timeoutMs >= 30_000)
})

test("el endpoint pide el CSV por el host registrado y devuelve las discontinuidades", () => {
  assert.match(route, /fetchRegistered/)
  assert.match(route, /datos\.magyp\.gob\.ar/)
  assert.match(route, /discontinuidades/)
  // El detalle del error no viaja al cliente: el envelope usa mensajes seguros.
  assert.doesNotMatch(route, /detail:/)
})
