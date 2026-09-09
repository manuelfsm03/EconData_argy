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
