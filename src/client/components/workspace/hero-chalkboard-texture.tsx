"use client"

/**
 * HeroChalkboardTexture — grano sutil de tiza/pizarrón sobre el fondo del
 * hero. Ruido SVG (feTurbulence) como data-URI, sin depender de ningún
 * asset — mismo enfoque que los glow layers del mapa de lluvias (filtros
 * SVG generados en el propio componente). Puramente decorativo: aria-hidden,
 * opacidad muy baja para no afectar el contraste del texto.
 */
const NOISE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
  <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter>
  <rect width='100%' height='100%' filter='url(%23n)'/>
</svg>`

export function HeroChalkboardTexture() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] mix-blend-overlay"
      style={{ backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")` }}
    />
  )
}
