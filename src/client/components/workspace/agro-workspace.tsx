"use client"

/**
 * AgroWorkspace — sección Agro del espacio de trabajo.
 *
 * Sección propia de navegación, como Calendario o Bonos: no es una tarjeta del
 * catálogo, así que no toca el inventario MVP ni el manifiesto numérico.
 *
 * Hoy arranca con producción y rendimientos del SIIA. Los módulos que siguen
 * (clima y agua, riesgo y seguros, impacto macro) se enchufan acá abajo.
 */

import { AgroProduccion } from "@/client/components/dashboard/agro-produccion"

export function AgroWorkspace() {
  return (
    <div style={{ padding: "16px 18px 32px" }}>
      <header style={{ marginBottom: 14, maxWidth: 820 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
          Agro
        </h1>
        <p style={{ fontSize: 11, color: "var(--text-mute)", margin: 0, lineHeight: 1.6 }}>
          Producción física del agro argentino a partir de fuentes oficiales dispersas, con la
          trazabilidad y los quiebres de cada serie a la vista.
        </p>
      </header>

      <div style={{ border: "1px solid var(--border)", background: "var(--bg-elev)" }}>
        <AgroProduccion />
      </div>
    </div>
  )
}
