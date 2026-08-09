# La Pizarra — Panel macro & financiero AR

Dashboard de datos económicos y financieros de Argentina. Next.js 14 + TypeScript +
Recharts, estética Bloomberg terminal. Deploy en Vercel.

**Repo:** `github.com/manuelfsm03/EconData_argy` (owner: manu) · **Deploy:** econ-data-argy.vercel.app

---

## Alcance de este repo

Este es un proyecto colaborativo con amigos. **No tiene ninguna relación con el
asistente personal de Luca** (Donna / calendario / Telegram / vault de Obsidian).
No importar código, contexto, credenciales ni convenciones de aquel proyecto, ni
mencionarlo en commits, PRs o comentarios. Son dos ramas separadas de la vida de Luca.

Todo el contexto necesario para trabajar acá está en este repo: este archivo,
`README.md` (arquitectura de datos) y `ROADMAP.md` (milestones y reparto de tareas).

---

## Equipo y reparto

| Persona | Área |
|---|---|
| gonza + **luca** | finanzas (renta fija, acciones) |
| juan + manu | economía + agro |
| pipe | noticias |
| lorenzo | noticias / geopolítica |

Luca trabaja la **Fase 1 — renta fija**: M1.1 soberanos hard dollar (con gonza),
M1.2 curva de rendimientos (con manu), M1.4 CER/DL (con juan), M1.6 ONs (con pipe).

## Reglas de trabajo (de ROADMAP.md, son del equipo — no negociables)

1. **Branches siempre.** Nadie pushea a `main`. Los PRs se revisan.
2. **Data first.** Si el dato no es confiable, no se muestra.
3. **API > scraping > manual.** Priorizar fuentes estables.
4. **Estética Bloomberg.** Consistencia visual: dark, panels, tablas, la paleta de abajo.
5. **Cada PR declara:** qué fuente de datos usa, cómo se actualiza, qué calcula.
6. **Documentar ecuaciones.** Cada cálculo financiero lleva su fórmula en comentarios.

La regla 6 es la que más se nota en `src/lib/bond-math.ts`: cada función documenta
su convención de day-count y de dónde sale. Mantener ese estándar.

---

## Arquitectura

```
src/
├── app/
│   ├── api/            41 route handlers, uno por dominio de datos
│   ├── page.tsx
│   └── layout.tsx
├── components/
│   ├── charts/         BBGLineChart, BBGAreaChart, BBGDataTable, BBGChartPanel
│   ├── dashboard/      un tab-*.tsx por sección + main-dashboard.tsx
│   └── ui/             primitivas (radix + tailwind)
├── lib/                lógica pura: bond-math, daycount, market-calendar, glossary
├── hooks/
└── scrapers/           BCRA, DolarAPI, CriptoYa, Rava, FinanzasArgy, RSS
```

**Tabs de primer nivel** (`main-dashboard.tsx`): Resumen · Finanzas · Macro · BCRA · Noticias.
Cada uno abre sub-tabs propios.

**Patrón de datos:** los route handlers en `app/api/` pegan a la fuente externa,
normalizan y devuelven JSON. Los componentes consumen con fetch. La lógica de
cálculo va en `src/lib/` como funciones puras, nunca dentro del componente —
así se puede verificar con scripts como `scripts/verify-bond-math.ts`.

**Prisma/SQLite** existe para los scrapers y el cron, no para las rutas que leen
APIs públicas en vivo.

## Motor de bonos (`src/lib/`)

Verificado contra la planilla del equipo (`Copia de Calculadoras de bonos.xlsx`, hoja GD30).
Correr `npx tsx scripts/verify-bond-math.ts` — las 9 métricas y las 2 invariantes en ok.

**Dos capas, a propósito.** Todavía no está definido de dónde se bajan los precios de
mercado, así que el motor no depende de eso para funcionar:

- `metricasDevengadas()` — sale todo del prospecto y la fecha. Valor residual,
  intereses corridos, valor técnico, tasa vigente, próximo pago, renta de los
  próximos 12 meses, vida promedio del capital (WAL), plazo residual. Disponible
  apenas se carga el esquema de un bono.
- `metricasDeMercado()` — TIR, duration, convexity, paridad, current yield, precio
  clean. Sólo para tickers con precio en `bond-prices.ts`.

Un bono se declara en `bond-schedule.ts` con fechas, tasa y amortización; **el cupón
se deriva**. Cargarlo a mano es lo que produjo el error de `bonds-data.ts`.
`validarEsquema()` chequea las invariantes (amortiza 100, fechas ordenadas y únicas,
último flujo = vencimiento, fuente declarada) y es el filtro obligatorio para bonos
cargados desde un prospecto.

`npx tsx scripts/bonos-tabla.ts [YYYY-MM-DD]` imprime todo a una fecha.

Los precios de `bond-prices.ts` llevan fuente y fecha, y la tabla marca
`FUENTE NO CONECTADA` cuando envejecen. No es cosmético: el precio de la planilla
usado a fecha de hoy da TIR 1.06% y paridad 100.62% en vez de 6.80% y 89.30%.
Creíble y falso — regla 2.

**Estado de los datos:** sólo GD30 tiene esquema verificado. Los otros ocho
(AL29, AL30, AL35, AL41, GD29, GD35, GD41, AE38) siguen en el viejo
`src/lib/bonds-data.ts` con amortizaciones que no cierran en 100 y cupones
inflados ~6x. No migrar ninguno sin prospecto o planilla que lo respalde.

Convenciones que replican la planilla:
- Intereses corridos devengan **30/360** (YEARFRAC basis 0).
- Descuento de flujos **Act/365** (basis 3), igual que XIRR.
- Los flujos se descuentan a la fecha de pago **corrida al día hábil siguiente**
  (`market-calendar.ts`).
- Todo por cada 100 de VN **original**, no del residual.

Desviación conocida y deliberada: `currentYield` no coincide con `excel[E5]` porque
la planilla suma cupones de 2025 ya cobrados. El código toma los próximos 12 meses
reales. El código está bien, la planilla no.

## Estética Bloomberg

Clases en `src/app/globals.css`: `.bbg-panel`, `.bbg-panel-header`.
El sistema de variables CSS con dark/light vive desde el commit `02acfc8`.

| Rol | Color |
|---|---|
| Naranja activo | `#FFA028` |
| Verde positivo | `#4AF6C3` |
| Rojo negativo | `#FF433D` |
| Azul datos | `#4FC3F7` |
| Grises UI | `#888` `#555` `#333` `#222` `#1a1a1a` `#111` `#0a0a0a` |

---

## Comandos

```bash
npm run dev          # localhost:3000
npm run build        # prisma generate && next build
npm run lint
npm run db:push      # sincronizar schema prisma
npm run scrape       # correr todos los scrapers
npx tsx scripts/verify-bond-math.ts
```

## Trabajar acá

- Rama nueva por feature, nombre `feat/…`, `fix/…` o `chore/…`.
- Antes de arrancar algo nuevo: `git fetch && git log origin/main..` para no
  duplicar lo que otro ya hizo. El repo tiene varias ramas activas en paralelo.
- Cálculo financiero nuevo → función pura en `src/lib/` + script de verificación
  contra fuente de referencia + fórmula documentada.
- Nada de datos inventados ni placeholders que parezcan reales (regla 2).
  Ya hubo una rama `chore/remove-fake-arb-scanner` justamente por eso.

## Notas técnicas que muerden

- **Vercel Hobby:** 10s de timeout en serverless. Las rutas lentas hay que cachearlas.
- **Yahoo Finance:** pegar directo a `query1.finance.yahoo.com/v8/finance/chart/{ticker}`.
  La librería `yfinance` está bloqueada en Vercel.
- **Lag fiscal:** el dataset 172 (recaudación ARCA) publica ~1 mes antes que el 452
  (series IMIG). El Sankey usa la última fecha con datos en IMIG.
- **`BCRA_TOKEN`** en `.env.local` sólo hace falta para riesgo país.
