import assert from "node:assert/strict"
import test from "node:test"

import { aplicarRuedaZoom, encuadrarPuntos, pasoZoomBoton, recentrarZoom } from "../src/lib/mapa-vista"

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

test("el botón de acercar sube el zoom y el de alejar lo baja", () => {
  const vista = { x: 0, y: 0, zoom: 2 }
  const opciones = { zoomMin: 1, zoomMax: 6 }
  assert.ok(pasoZoomBoton(vista, "acercar", CENTRO, opciones).zoom > vista.zoom)
  assert.ok(pasoZoomBoton(vista, "alejar", CENTRO, opciones).zoom < vista.zoom)
})

test("encuadrar puntos deja el centro de esos puntos en el centro del viewport", () => {
  const puntos = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 100, y: 200 }, { x: 200, y: 200 }]
  const viewport = { ancho: 560, alto: 620 }
  const vista = encuadrarPuntos(puntos, viewport, { zoomMin: 1, zoomMax: 6 })

  // El centro de datos es (150,150); tiene que proyectar al centro del viewport.
  const proyectado = { x: vista.zoom * 150 + vista.x, y: vista.zoom * 150 + vista.y }
  assert.ok(Math.abs(proyectado.x - viewport.ancho / 2) < 1e-6)
  assert.ok(Math.abs(proyectado.y - viewport.alto / 2) < 1e-6)
})

test("encuadrar puntos deja todo el bounding box dentro del viewport", () => {
  const puntos = [{ x: 50, y: 300 }, { x: 480, y: 300 }, { x: 260, y: 40 }, { x: 260, y: 580 }]
  const viewport = { ancho: 560, alto: 620 }
  const vista = encuadrarPuntos(puntos, viewport, { zoomMin: 1, zoomMax: 6 })

  for (const p of puntos) {
    const proyectado = { x: vista.zoom * p.x + vista.x, y: vista.zoom * p.y + vista.y }
    assert.ok(proyectado.x >= -1 && proyectado.x <= viewport.ancho + 1, `x=${proyectado.x} fuera de rango`)
    assert.ok(proyectado.y >= -1 && proyectado.y <= viewport.alto + 1, `y=${proyectado.y} fuera de rango`)
  }
})

test("un solo punto (o un país chiquito como Uruguay) respeta el piso de tamaño, no el zoom máximo del techo global", () => {
  // zoomMax bien alto para aislar el efecto del piso: si el piso no
  // existiera, un solo punto (ancho/alto real = 0) daría zoom infinito.
  const vista = encuadrarPuntos([{ x: 300, y: 300 }], { ancho: 560, alto: 620 }, { zoomMin: 1, zoomMax: 50, anchoMinimo: 60, altoMinimo: 60 })
  // Con piso 60×60 y margen 1.35, el zoom queda ~6.9 (560/81): lejos del
  // techo de 50, así que lo que lo frena es el piso, no el límite global.
  assert.ok(vista.zoom > 5 && vista.zoom < 8, `zoom ${vista.zoom} debería salir del piso de tamaño (~6.9), no del techo`)
})

test("encuadrar sin puntos no rompe: devuelve la vista general", () => {
  const vista = encuadrarPuntos([], { ancho: 560, alto: 620 }, { zoomMin: 1, zoomMax: 6 })
  assert.equal(vista.zoom, 1)
})

test("un país más chico (menos extensión) termina con más zoom que uno grande", () => {
  const viewport = { ancho: 560, alto: 620 }
  const opciones = { zoomMin: 1, zoomMax: 6 }
  const paisChico = encuadrarPuntos([{ x: 280, y: 280 }, { x: 300, y: 300 }], viewport, opciones)
  const paisGrande = encuadrarPuntos([{ x: 20, y: 20 }, { x: 500, y: 550 }], viewport, opciones)
  assert.ok(paisChico.zoom > paisGrande.zoom)
})
