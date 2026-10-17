"use client"

import { useEffect, useRef } from "react"

const NODES = [
  [222, 154, 4, false], [112, 370, 2.5, false], [404, 650, 3, true],
  [1228, 286, 5, true], [1358, 472, 3, false], [1035, 694, 2.5, false],
] as const

const MARKET_CURVE = "M0 302L74 302L126 294L188 298L246 277L318 280L356 269L432 269L478 286L538 283L602 261L654 266L720 254L792 260L858 245L932 251L990 248L1042 270L1094 269L1156 286L1224 279L1286 295L1362 290L1440 302"
const MARKET_AREA = `${MARKET_CURVE}L1440 340L0 340Z`

export function LandingAmbient() {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const finePointer = window.matchMedia("(pointer: fine)")
    const nodes = Array.from(root.querySelectorAll<SVGGElement>("[data-landing-node]"))
    let frame = 0
    let scrollFrame = 0

    const render = (clientX: number, clientY: number) => {
      frame = 0
      const x = Math.min(window.innerWidth, Math.max(0, clientX))
      const y = Math.min(window.innerHeight, Math.max(0, clientY))
      root.style.setProperty("--pointer-x", `${x}px`)
      root.style.setProperty("--pointer-y", `${y}px`)
      root.style.setProperty("--pointer-active", "1")
      const svgX = x / Math.max(1, window.innerWidth) * 1440
      const svgY = y / Math.max(1, window.innerHeight) * 900
      nodes.forEach((node) => {
        const strength = Math.max(0, 1 - Math.hypot(svgX - Number(node.dataset.x), svgY - Number(node.dataset.y)) / 270)
        node.style.setProperty("--node-heat", strength.toFixed(3))
      })
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || reduceMotion.matches || !finePointer.matches) return
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => render(event.clientX, event.clientY))
    }
    const reset = () => {
      root.style.setProperty("--pointer-active", "0")
      nodes.forEach((node) => node.style.setProperty("--node-heat", "0"))
    }
    const syncScroll = () => {
      scrollFrame = 0
      root.classList.toggle("is-after-hero", window.scrollY > window.innerHeight * 0.72)
    }
    const onScroll = () => {
      if (scrollFrame) return
      scrollFrame = requestAnimationFrame(syncScroll)
    }
    const syncVisibility = () => {
      root.classList.toggle("is-paused", document.visibilityState !== "visible")
      if (document.visibilityState !== "visible") reset()
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("blur", reset)
    document.documentElement.addEventListener("mouseleave", reset)
    document.addEventListener("visibilitychange", syncVisibility)
    syncScroll()
    syncVisibility()
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("blur", reset)
      document.documentElement.removeEventListener("mouseleave", reset)
      document.removeEventListener("visibilitychange", syncVisibility)
      if (frame) cancelAnimationFrame(frame)
      if (scrollFrame) cancelAnimationFrame(scrollFrame)
    }
  }, [])

  return (
    <div ref={rootRef} className="landing-global-ambient" aria-hidden="true">
      <div className="landing-global-light" />
      <svg className="landing-network" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="landing-market-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#a8aba6" stopOpacity="0" />
            <stop offset=".26" stopColor="#c7c5bd" stopOpacity=".42" />
            <stop offset=".45" stopColor="#ed913f" stopOpacity=".28" />
            <stop offset=".485" stopColor="#ed913f" stopOpacity="0" />
            <stop offset=".515" stopColor="#ed913f" stopOpacity="0" />
            <stop offset=".55" stopColor="#ed913f" stopOpacity=".28" />
            <stop offset=".74" stopColor="#c7c5bd" stopOpacity=".42" />
            <stop offset="1" stopColor="#a8aba6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="landing-market-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ed913f" stopOpacity=".15" />
            <stop offset="1" stopColor="#ed913f" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="landing-market-track">
          <g className="landing-market-copy">
            <path className="landing-market-area" d={MARKET_AREA} />
            <path className="landing-market-line" d={MARKET_CURVE} />
          </g>
          <g className="landing-market-copy" transform="translate(1440 0)">
            <path className="landing-market-area" d={MARKET_AREA} />
            <path className="landing-market-line" d={MARKET_CURVE} />
          </g>
        </g>
        <g className="landing-network-nodes">
          {NODES.map(([x, y, radius, accent]) => (
            <g key={`${x}-${y}`} className={`landing-network-node ${accent ? "accent" : ""}`} data-landing-node data-x={x} data-y={y} transform={`translate(${x} ${y})`}>
              <circle className="halo" r={radius * 5.5} />
              <circle className="core" r={radius} />
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}
