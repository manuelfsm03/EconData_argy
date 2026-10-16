"use client"

/** Abre el diálogo de impresión del navegador ("Guardar como PDF" da el A4 del informe). */
export function BotonImprimir() {
  return (
    <button type="button" className="informe-boton" onClick={() => window.print()}>
      Imprimir / guardar PDF
    </button>
  )
}
