/**
 * Matemática de pan/zoom para mapas SVG con transform="translate(x,y) scale(z)".
 *
 * Lógica pura, separada del componente, porque una vez ya salió mal a ojo:
 * escalar directo desde el origen (0,0) del viewBox saca todo el contenido
 * de cuadro apenas tocás la rueda, porque (0,0) casi nunca es el punto que
 * estás mirando. Hay que recalcular el pan cada vez que cambia el zoom para
 * que el centro visible se quede quieto.
 */

export type VistaMapa = { x: number; y: number; zoom: number }

/**
 * Recalcula el pan para que, al cambiar de `vista.zoom` a `zoomNuevo`, el
 * punto que hoy se ve en el centro del viewBox (`centro`) siga viéndose ahí.
 *
 * Deducción: con transform = translate(x,y) scale(z), un punto de datos p
 * aparece en pantalla en `z·p + (x,y)`. Si `centro` es el punto en pantalla
 * fijo, el dato que hoy cae ahí es `p_centro = (centro - (x,y)) / z`. Para
 * que `p_centro` siga cayendo en `centro` con el zoom nuevo, hace falta
 * `(x',y') = centro - zoomNuevo · p_centro`, que se simplifica al `factor`
 * de abajo sin necesitar despejar p_centro aparte.
 */
export function recentrarZoom(vista: VistaMapa, zoomNuevo: number, centro: { x: number; y: number }): VistaMapa {
  const factor = zoomNuevo / vista.zoom
  return {
    zoom: zoomNuevo,
    x: centro.x - factor * (centro.x - vista.x),
    y: centro.y - factor * (centro.y - vista.y),
  }
}

/** Aplica un paso de rueda de mouse a la vista, respetando los límites de zoom. */
export function aplicarRuedaZoom(
  vista: VistaMapa,
  deltaY: number,
  centro: { x: number; y: number },
  opciones: { zoomMin: number; zoomMax: number; pasoZoom?: number },
): VistaMapa {
  const paso = opciones.pasoZoom ?? 1.18
  const zoomNuevo = Math.min(opciones.zoomMax, Math.max(opciones.zoomMin, vista.zoom * (deltaY < 0 ? paso : 1 / paso)))
  return recentrarZoom(vista, zoomNuevo, centro)
}

/** Un paso de zoom fijo (para los botones +/−, que no dependen de la rueda del mouse). */
export function pasoZoomBoton(
  vista: VistaMapa,
  direccion: "acercar" | "alejar",
  centro: { x: number; y: number },
  opciones: { zoomMin: number; zoomMax: number },
): VistaMapa {
  return aplicarRuedaZoom(vista, direccion === "acercar" ? -1 : 1, centro, opciones)
}

/**
 * Encuadra un conjunto de puntos (en coordenadas de datos, mismas unidades
 * que el viewBox) centrado en el viewport, con margen.
 *
 * Es lo que pide "navegar a Brasil": en vez de sólo filtrar qué puntos se
 * muestran y dejar la vista general (donde Uruguay ocupa 40 píxeles), esto
 * mueve y acerca la cámara para que ese país llene la pantalla.
 *
 * Un solo punto (o puntos muy juntos) no debe disparar el zoom al máximo:
 * `anchoMinimo`/`altoMinimo` ponen un piso al tamaño del área a encuadrar.
 */
export function encuadrarPuntos(
  puntos: readonly { x: number; y: number }[],
  viewport: { ancho: number; alto: number },
  opciones: { zoomMin: number; zoomMax: number; margen?: number; anchoMinimo?: number; altoMinimo?: number },
): VistaMapa {
  if (puntos.length === 0) return { x: 0, y: 0, zoom: opciones.zoomMin }

  const xs = puntos.map((p) => p.x)
  const ys = puntos.map((p) => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)

  const margen = opciones.margen ?? 1.35
  const ancho = Math.max(maxX - minX, opciones.anchoMinimo ?? 40) * margen
  const alto = Math.max(maxY - minY, opciones.altoMinimo ?? 40) * margen

  const zoomCrudo = Math.min(viewport.ancho / ancho, viewport.alto / alto)
  const zoom = Math.min(opciones.zoomMax, Math.max(opciones.zoomMin, zoomCrudo))

  const centroDatos = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
  const centroViewport = { x: viewport.ancho / 2, y: viewport.alto / 2 }

  return {
    zoom,
    x: centroViewport.x - zoom * centroDatos.x,
    y: centroViewport.y - zoom * centroDatos.y,
  }
}
