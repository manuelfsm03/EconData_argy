import assert from "node:assert/strict"
import test from "node:test"

import { aplicarRuedaZoom, recentrarZoom } from "../src/lib/mapa-vista"

const CENTRO = { x: 280, y: 310 }

test("con pan en cero, hacer zoom sobre el centro no mueve el punto que estaba en el centro", () => {
  // Este es el bug real que salió al probar en pantalla: escalar sin
  // recentrar tira el contenido fuera de cuadro apenas cambia el zoom.
  const vista = { x: 0, y: 0, zoom: 1 }
  const siguiente = recentrarZoom(vista, 3, CENTRO)

  // El dato que hoy se ve en CENTRO (con zoom 1 y pan 0, es el propio CENTRO
  // en coordenadas de datos) tiene que seguir cayendo en CENTRO con zoom 3.
  const puntoEnPantalla = {
    x: siguiente.zoom * CENTRO.x + siguiente.x,
    y: siguiente.zoom * CENTRO.y + siguiente.y,
  }
  assert.ok(Math.abs(puntoEnPantalla.x - CENTRO.x) < 1e-9)
  assert.ok(Math.abs(puntoEnPantalla.y - CENTRO.y) < 1e-9)
})

test("recentrar preserva el punto de datos que está bajo el centro, con pan previo distinto de cero", () => {
  const vista = { x: 40, y: -25, zoom: 1.5 }
  // Dato que hoy cae en CENTRO, dado el pan y zoom actuales.
  const datoEnCentro = { x: (CENTRO.x - vista.x) / vista.zoom, y: (CENTRO.y - vista.y) / vista.zoom }

  const siguiente = recentrarZoom(vista, 4, CENTRO)
  const dondeQuedoEseDato = {
    x: siguiente.zoom * datoEnCentro.x + siguiente.x,
    y: siguiente.zoom * datoEnCentro.y + siguiente.y,
  }
  assert.ok(Math.abs(dondeQuedoEseDato.x - CENTRO.x) < 1e-9)
  assert.ok(Math.abs(dondeQuedoEseDato.y - CENTRO.y) < 1e-9)
})

test("recentrar con el mismo zoom no cambia nada (caso borde)", () => {
  const vista = { x: 12, y: 8, zoom: 2 }
  const siguiente = recentrarZoom(vista, 2, CENTRO)
  assert.deepEqual(siguiente, vista)
})

test("la rueda hacia adelante agranda, hacia atrás achica", () => {
  const vista = { x: 0, y: 0, zoom: 2 }
  const opciones = { zoomMin: 1, zoomMax: 6 }

  const acercando = aplicarRuedaZoom(vista, -120, CENTRO, opciones)
  assert.ok(acercando.zoom > vista.zoom)

  const alejando = aplicarRuedaZoom(vista, 120, CENTRO, opciones)
  assert.ok(alejando.zoom < vista.zoom)
})

test("el zoom nunca sale del rango permitido", () => {
  const opciones = { zoomMin: 1, zoomMax: 6 }

  let vista = { x: 0, y: 0, zoom: 1 }
  for (let i = 0; i < 40; i++) vista = aplicarRuedaZoom(vista, -120, CENTRO, opciones)
  assert.ok(vista.zoom <= 6)

  vista = { x: 0, y: 0, zoom: 6 }
  for (let i = 0; i < 40; i++) vista = aplicarRuedaZoom(vista, 120, CENTRO, opciones)
  assert.ok(vista.zoom >= 1)
})

test("un paso de zoom más agresivo agranda más rápido", () => {
  const vista = { x: 0, y: 0, zoom: 1 }
  const opciones = { zoomMin: 1, zoomMax: 10 }
  const suave = aplicarRuedaZoom(vista, -120, CENTRO, { ...opciones, pasoZoom: 1.1 })
  const agresivo = aplicarRuedaZoom(vista, -120, CENTRO, { ...opciones, pasoZoom: 1.5 })
  assert.ok(agresivo.zoom > suave.zoom)
})
