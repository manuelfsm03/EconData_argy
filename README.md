# EconData Argentina — Dashboard Macroeconómico

Dashboard de datos económicos de Argentina en tiempo real, con estética Bloomberg terminal (dark mode). Construido con Next.js 14 + TypeScript + Recharts.

**Producción:** [lapizarra.ar](https://lapizarra.ar)

## Repositorio canónico y espejo

- `manuelfsm03/EconData_argy` es la fuente canónica de producto.
- `000gon/paneldecontrol` es un espejo operativo exacto de `EconData_argy/main` y alimenta el deploy de `lapizarra.ar`.
- Las features se integran primero en el repositorio canónico. El workflow `sync-upstream.yml` replica después el mismo commit a `paneldecontrol/main`.
- Una release no está completa hasta verificar igualdad de árbol entre ambos `main` y hacer smoke test de producción.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Gráficos | Recharts (LineChart, BarChart, AreaChart, Sankey custom) |
| Estilos | CSS global con variables `.bbg-*` (Bloomberg dark) |
| API Routes | Next.js Route Handlers (`src/app/api/`) |
| Fuentes de datos | datos.gob.ar (INDEC/BCRA), dolarapi.com, populationpyramid.net, UTDT, Yahoo Finance |
| Deploy | Vercel Hobby (serverless, 10s timeout) |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── macro/route.ts          ← EMAE, IPC, Fiscal, EMAE sectorial, laboral, estructural
│   │   ├── dolares/route.ts        ← Tipos de cambio (dolarapi.com)
│   │   ├── bcra-data/route.ts      ← Reservas, BADLAR
│   │   ├── bonos/route.ts          ← Screener soberanos y LECAPs
│   │   ├── deuda/route.ts          ← Deuda pública
│   │   ├── mundo/route.ts          ← Mercados globales (Yahoo Finance)
│   │   └── ...
│   └── page.tsx
└── components/
    ├── charts/
    │   ├── bbg-line-chart.tsx      ← Gráfico de líneas con toggle y rangos de fecha
    │   ├── bbg-area-chart.tsx      ← Gráfico de área BBG
    │   └── ...
    └── dashboard/
        ├── tab-macro.tsx           ← Tab principal: EMAE, IPC, Fiscal, Estructural
        ├── fiscal-sankey.tsx       ← Sankey fiscal (5 tabs)
        ├── tab-tipos-cambio.tsx
        ├── tab-bonos.tsx
        └── ...
```

---

## Módulo Macro (tab-macro.tsx)

El tab de Macroeconomía Argentina se divide en 5 sub-tabs principales:

### EMAE
5 sub-tabs internos:

| Sub-tab | Contenido |
|---|---|
| **Actividad** | Gráfico de área EMAE 12 meses + tabla de últimos períodos |
| **Apertura Sectorial** | Ranking de barras divergentes (15 sectores, variación interanual) + gráfico de líneas con toggle por sector |
| **Mercado Laboral** | Tasas EPH: desocupación, actividad, empleo, subocupación |
| **Estructural** | PBI, PBI per cápita, Gini, SMVM, natalidad, mortalidad infantil, esperanza de vida, pirámide poblacional dinámica (UN WPP 1950–2100) |
| **Industria & Confianza** | UCI (Utilización Capacidad Instalada), ventas supermercados, ICC (UTDT), ICG (UTDT) |

### IPC
- Variación mensual e interanual del IPC general
- Desglose por divisiones (alimentos, indumentaria, vivienda, etc.)
- Evolución histórica

### Balanza Comercial
- Exportaciones e importaciones mensuales
- Saldo comercial acumulado

### Fiscal (fiscal-sankey.tsx)
Sankey diagram con 5 tabs:

| Tab | Descripción |
|---|---|
| **Flujo Fiscal** | Sankey Bloomberg-style: Ingresos → Gasto → Resultado Primario/Financiero. Ingresos descompuestos en 9 categorías (IVA, Ganancias, Seg. Social, Déb./Créd., Der. Export., Der. Import., Bs. Personales, Otros DGI, Otros Aduana) |
| **Distribución Federal** | Coparticipación federal a provincias |
| **Cashflow** | Flujo de caja del sector público |
| **Ahorro-Inversión** | Balance ahorro-inversión |
| **Vista Anual** | Gráfico de barras apiladas con acumulado anual y superávit/déficit residual |

### Pirámides
- Pirámide poblacional interactiva por año (1950–2100)
- Fuente: populationpyramid.net / UN World Population Prospects 2024
- Proyecciones marcadas en naranja para años > 2025

---

## Componente BBGLineChart

`src/components/charts/bbg-line-chart.tsx`

Props principales:

| Prop | Tipo | Descripción |
|---|---|---|
| `data` | `Record<string, unknown>[]` | Array de datos con campo `date` |
| `lines` | `LineConfig[]` | Líneas a graficar (key, nombre, color, yAxisId, dashed) |
| `enableDateRange` | `boolean` | Botones de rango 1S/1M/3M/6M/1A/YTD/MAX |
| `enableLineToggle` | `boolean` | Botones para mostrar/ocultar líneas individualmente |
| `defaultRange` | `DateRange` | Rango inicial por defecto |
| `yAxisRight` | `object` | Configura eje Y derecho opcional |
| `showZeroLine` | `boolean` | Línea de referencia en y=0 |

---

## API Routes principales

### `/api/macro?endpoint=emae_sectorial`
- Fuente: CSV INDEC (`infra.datos.gob.ar/catalog/sspm/dataset/11/...`)
- Retorna últimas 25 observaciones mensuales con 16 sectores
- Sectores: agro, pesca, minería, industria, energía, construcción, comercio, turismo, transporte, finanzas, inmobiliarias, adm. pública, enseñanza, salud, serv. comunitarios, imp. netos subsidios

### `/api/macro?endpoint=fiscal_sankey`
- Series INDEC vía `apis.datos.gob.ar/series/api/series/`
- Incluye: `recaudacion`, `rec_dgi`, `rec_dga`, `rec_iva`, `rec_ganancias`, `rec_seg_social`, `rec_deb_cred`, `rec_der_expo`, `rec_der_impo`, `rec_bs_personales`, `resultado_primario`, `resultado_financiero`
- Período default: última fecha disponible en series IMIG (dataset 452), no en recaudación total (dataset 172), para evitar lag de publicación

### `/api/macro?endpoint=estructural`
- PBI, PBI per cápita, SMVM, Gini (EPH), población, natalidad, mortalidad infantil, esperanza de vida

---

## Estética Bloomberg dark

Clases CSS globales definidas en `src/app/globals.css`:

```css
.bbg-panel          /* Contenedor: border #222, bg #000 */
.bbg-panel-header   /* Header: bg #1a1a1a, texto blanco mayúsculas, fontSize 11px */
```

Paleta de colores:
- Naranja activo: `#FFA028`
- Verde positivo: `#4AF6C3`
- Rojo negativo: `#FF433D`
- Azul datos: `#4FC3F7`
- Grises UI: `#888`, `#555`, `#333`, `#222`, `#1a1a1a`, `#111`, `#0a0a0a`

---

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Variables de entorno opcionales (`.env.local`):
```
BCRA_TOKEN=...    # Token BCRA para estadisticasbcra.com (no requerido en dev)
```

---

## Fuentes de datos

| Dato | Fuente | Auth |
|---|---|---|
| EMAE, IPC, laboral, estructural | `apis.datos.gob.ar` (INDEC) | No |
| EMAE sectorial, UCI, supermercados | `infra.datos.gob.ar` (INDEC CSV) | No |
| Recaudación fiscal | `apis.datos.gob.ar` dataset 172 (ARCA) | No |
| Tipos de cambio | `dolarapi.com/v1/dolares` | No |
| Reservas BCRA | `datos.gob.ar` serie `92.2_RESERVAS_IRES_0_0_32_40` | No |
| ICC/ICG | `infra.datos.gob.ar` (UTDT CSV) | No |
| Pirámide poblacional | `populationpyramid.net` | No |
| Mercados globales | Yahoo Finance chart API (httpx directo) | No |
| Riesgo País | `estadisticasbcra.com/rp` | BCRA_TOKEN |

---

## Notas técnicas importantes

- **Dataset lag fiscal**: El dataset 172 (ARCA recaudación total) publica datos ~1 mes antes que el dataset 452 (IMIG series individuales). El período por defecto del Sankey usa la última fecha con datos en series IMIG, no en recaudación total.
- **Otros DGI**: `DGI total − IVA − Ganancias − Déb/Créd − Bs. Personales` → incluye Combustibles, Impuestos Internos, Monotributo, Ganancia Mínima Presunta y resto DGI.
- **Otros Aduana**: `DGA total − Der. Exportación − Der. Importación` → incluye IVA sobre importaciones, tasas estadísticas y otros derechos aduaneros.
- **Variación interanual EMAE sectorial**: calculada desde índice base 2004 como `(val_t / val_{t-12} − 1) × 100`, no desde serie pre-computada.
- **Yahoo Finance en Vercel**: usar `httpx` directo a `query1.finance.yahoo.com/v8/finance/chart/{ticker}` — la librería `yfinance` está bloqueada en Vercel.
