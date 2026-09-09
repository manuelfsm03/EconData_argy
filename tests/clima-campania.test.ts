import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  acumularPorCampania,
  campaniaDe,
  etiquetaCampania,
  promediarZona,
  resumirLluvia,
  sensibilidadClimaRinde,
  zonaPorId,
  ZONAS_AGRICOLAS,
  type PuntoRinde,
} from "../src/server/external/clima-campania"
import { SOURCE_REGISTRY } from "../src/server/sources/registry"

const route = readFileSync("src/app/api/agro-clima/route.ts", "utf8")

test("la campaña agrícola arranca en octubre y cierra en marzo", () => {
  assert.equal(campaniaDe("2022-10-01"), 2022)
  assert.equal(campaniaDe("2022-12-31"), 2022)
  assert.equal(campaniaDe("2023-01-15"), 2022)
  assert.equal(campaniaDe("2023-03-31"), 2022)
  assert.equal(etiquetaCampania(2022), "2022/2023")
})

test("los meses entre campañas no se cuentan", () => {
  // Abril a septiembre queda fuera del ciclo de verano: contarlo inflaría la
  // lluvia de la campaña con agua que cayó cuando no había cultivo.
  for (const fecha of ["2023-04-01", "2023-06-15", "2023-09-30"]) {
    assert.equal(campaniaDe(fecha), null, `${fecha} no pertenece a ninguna campaña`)
  }
})

test("acumula la lluvia diaria dentro de cada campaña", () => {
  const fechas = ["2022-10-05", "2022-11-10", "2023-02-20", "2023-07-01", "2023-10-02"]
  const mm = [10, 5.5, 4.5, 100, 8]
  const serie = acumularPorCampania(fechas, mm)

  assert.equal(serie.length, 2)
  assert.equal(serie[0].etiqueta, "2022/2023")
  assert.equal(serie[0].mm, 20)          // 10 + 5.5 + 4.5, sin el julio
  assert.equal(serie[0].diasConDato, 3)
  assert.equal(serie[1].etiqueta, "2023/2024")
  assert.equal(serie[1].mm, 8)
})

test("los días sin dato se saltean sin contar como cero", () => {
  const serie = acumularPorCampania(
    ["2022-10-01", "2022-10-02", "2022-10-03"],
    [10, null, 5],
  )
  assert.equal(serie[0].mm, 15)
  assert.equal(serie[0].diasConDato, 2)
})

test("el promedio de zona exige que todos los puntos cubran la campaña", () => {
  const punto1 = acumularPorCampania(["2021-10-01", "2022-10-01"], [100, 200])
  const punto2 = acumularPorCampania(["2022-10-01"], [300])   // arranca más tarde

  const zona = promediarZona([punto1, punto2])

  // 2021/2022 se descarta: con un solo punto el nivel de la serie saltaría por
  // un cambio en la muestra, no por el clima.
  assert.equal(zona.length, 1)
  assert.equal(zona[0].etiqueta, "2022/2023")
  assert.equal(zona[0].mm, 250)
})

test("el resumen ubica la última campaña contra su historia", () => {
  const serie = [100, 200, 300, 400, 50].map((mm, i) => ({
    campania: 2000 + i, etiqueta: etiquetaCampania(2000 + i), mm, diasConDato: 180,
  }))
  const resumen = resumirLluvia(serie)

  assert.equal(resumen.campanias, 5)
  assert.equal(resumen.promedioMm, 210)
  assert.equal(resumen.ultima?.mm, 50)
  assert.equal(resumen.percentilUltima, 0)        // la más seca de todas
  assert.equal(resumen.desvioVsPromedioPct, -76.2)
  assert.equal(resumen.masSecas[0].mm, 50)
})

test("resumir una serie vacía no rompe", () => {
  const resumen = resumirLluvia([])
  assert.equal(resumen.campanias, 0)
  assert.equal(resumen.ultima, null)
  assert.equal(resumen.percentilUltima, null)
})

test("la sensibilidad separa la tendencia tecnológica de la señal climática", () => {
  // Serie sintética: el rinde sube 25 kg/ha por año por tecnología y además
  // responde 2 kg/ha por cada mm de lluvia.
  const lluvias = [500, 700, 400, 800, 600, 900, 450, 750, 550, 650, 850, 350]
  const lluvia = lluvias.map((mm, i) => ({
    campania: 2000 + i, etiqueta: etiquetaCampania(2000 + i), mm, diasConDato: 180,
  }))
  const rinde: PuntoRinde[] = lluvias.map((mm, i) => ({
    campania: 2000 + i,
    rendimientoKgHa: 1000 + 25 * i + 2 * mm,
  }))

  const s = sensibilidadClimaRinde(lluvia, rinde)
  assert.ok(s)
  assert.equal(s.campaniasCruzadas, 12)
  // La tendencia plantada se recupera y la sensibilidad da los 200 kg/ha por
  // cada 100 mm que se metieron en los datos.
  assert.ok(Math.abs(s.tendenciaKgHaPorAnio - 25) < 3, `tendencia ${s.tendenciaKgHaPorAnio}`)
  assert.ok(Math.abs(s.kgHaPor100mm - 200) < 12, `sensibilidad ${s.kgHaPor100mm}`)
  assert.ok(s.correlacionDetrend > 0.95, `correlación ${s.correlacionDetrend}`)
})

test("sacar la tendencia revela una señal que la correlación cruda esconde", () => {
  // Tendencia fuerte y clima moderado: en niveles la correlación se diluye.
  const lluvias = [600, 400, 700, 350, 650, 500, 750, 380, 620, 480, 720, 420]
  const lluvia = lluvias.map((mm, i) => ({
    campania: 2000 + i, etiqueta: etiquetaCampania(2000 + i), mm, diasConDato: 180,
  }))
  const rinde: PuntoRinde[] = lluvias.map((mm, i) => ({
    campania: 2000 + i,
    rendimientoKgHa: 1500 + 90 * i + 1.5 * mm,
  }))

  const s = sensibilidadClimaRinde(lluvia, rinde)
  assert.ok(s)
  assert.ok(s.correlacionDetrend > s.correlacionCruda,
    `detrend ${s.correlacionDetrend} debería superar a cruda ${s.correlacionCruda}`)
})

test("sin campañas suficientes no se devuelve una sensibilidad inventada", () => {
  const lluvia = [1, 2, 3].map((i) => ({
    campania: 2000 + i, etiqueta: etiquetaCampania(2000 + i), mm: 500 + i, diasConDato: 180,
  }))
  const rinde: PuntoRinde[] = [1, 2, 3].map((i) => ({ campania: 2000 + i, rendimientoKgHa: 3000 }))
  assert.equal(sensibilidadClimaRinde(lluvia, rinde), null)
})

test("las zonas declaran puntos con provincia para poder ponderar el rinde", () => {
  assert.ok(ZONAS_AGRICOLAS.length >= 3)
  for (const zona of ZONAS_AGRICOLAS) {
    assert.ok(zona.puntos.length > 0, `${zona.id} sin puntos`)
    for (const punto of zona.puntos) {
      assert.ok(punto.provincia.length > 0, `${punto.nombre} sin provincia`)
      assert.ok(punto.lat < 0 && punto.lon < 0, `${punto.nombre} fuera del cuadrante argentino`)
    }
  }
  assert.equal(zonaPorId("nucleo")?.nombre, "Zona núcleo")
  assert.equal(zonaPorId("inexistente"), undefined)
})

test("el endpoint avisa que la lluvia es reanálisis y no observación", () => {
  assert.match(route, /reanálisis ERA5/)
  assert.match(route, /no reemplaza la medición en tierra/)
  assert.match(route, /warnings:/)
  assert.match(route, /fetchRegistered/)
})

test("la fuente ERA5 está registrada con su ventana anual", () => {
  const fuente = SOURCE_REGISTRY.open_meteo_archive
  assert.equal(fuente.dataClass, "annual")
  assert.ok(fuente.allowedHosts.includes("archive-api.open-meteo.com"))
  assert.ok(fuente.timeoutMs >= 45_000)
})
