"use client"

/**
 * Encabezado de sección de los tableros: título en ámbar y, opcionalmente, la
 * fuente del dato alineada a la derecha.
 *
 * Vive acá para que las secciones nuevas no vuelvan a copiarlo. Las pestañas
 * viejas (tab-macro, tab-bcra, tab-bonos, tab-finanzas, tab-mundo) todavía
 * tienen su propia copia local: migrarlas es una limpieza aparte.
 */
export function SectionHeader({ title, source }: { title: string; source?: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 10px", background: "var(--bg-elev-2)",
      borderTop: "2px solid var(--border)", borderBottom: "1px solid var(--border)", marginTop: 8,
    }}>
      <span style={{ fontSize: 9, color: "var(--amber)", textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>
        {title}
      </span>
      {source && (
        <span style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>
          {source}
        </span>
      )}
    </div>
  )
}
