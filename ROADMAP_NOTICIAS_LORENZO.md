# ROADMAP — Apartado de Noticias
> **Responsable:** Lorenzo  
> **Rama:** `lorenzo`  
> **Última actualización:** 02 marzo 2026

---

## Estado actual

Ya existe en el proyecto:
- ✅ `NewsFeed` — tabla RSS básica (Ámbito, Infobae, Cronista, iProfesional, BAE Negocios)
- ✅ `TabGeopolitica` — noticias internacionales con categorías y filtros
- ✅ `/api/rss-news` — endpoint RSS multi-fuente
- ✅ `/api/geopolitica` — endpoint RSS internacional con categorización
- ✅ `/api/noticias/[ticker]` — noticias por ticker (usado en detalle de acciones)

---

## FASE 1 — Mejorar el feed actual (M5.1)
> Prioridad: ALTA

### M5.1.1 — Refactor del componente `NewsFeed`
- [ ] Rediseño visual: layout de dos columnas (lista izquierda + preview derecha)
- [ ] Chips de filtro por categoría: `macro`, `finanzas`, `agro`, `crypto`, `geopolítica`
- [ ] Buscador por keyword en tiempo real
- [ ] Detección y eliminación de noticias duplicadas
- [ ] Indicador de tiempo relativo ("hace 5 min", "hace 2 hs")
- [ ] Paginación o scroll infinito

### M5.1.2 — Mejorar el API `/api/rss-news`
- [ ] Agregar más fuentes: Reuters LATAM, Bloomberg Línea, La Nación Economía
- [ ] Categorización automática de noticias (mismo sistema que `TabGeopolitica`)
- [ ] Deduplicación server-side por título similar (no solo por URL)
- [ ] Caché más inteligente: TTL diferente por fuente
- [ ] Endpoint con soporte para query params: `?categoria=macro&fuente=ambito&limit=20`

### M5.1.3 — Unificación NEWS + GEOPOLÍTICA
- [ ] Fusionar ambos tabs en uno con subtabs internos:
  - `Argentina` — fuentes locales
  - `Global` — BBC, Al Jazeera, France24
  - `Geopolítica` — con impacto AR (lo que ya existe)
- [ ] Evitar duplicación de lógica entre `NewsFeed` y `TabGeopolitica`

---

## FASE 2 — Cables estilo Bloomberg (M5.2)
> Prioridad: MEDIA

### M5.2.1 — Ticker tape de noticias
- [ ] Barra horizontal en la parte superior del dashboard
- [ ] Noticias desfilando de derecha a izquierda en loop
- [ ] Visible desde cualquier tab del panel
- [ ] Click en una noticia abre el link en nueva pestaña
- [ ] Pausa al hacer hover

### M5.2.2 — Panel de breaking news
- [ ] Detector de noticias "importantes" por keywords: `BCRA`, `dólar`, `FMI`, `Milei`, `reservas`
- [ ] Notificación visual cuando entra una noticia de alto impacto
- [ ] Badge contador de noticias nuevas desde última visita

---

## FASE 3 — Features avanzados (M5.3)
> Prioridad: BAJA (post FASE 1 y 2)

### M5.3.1 — Resumen automático con IA
- [ ] Botón "Resumir" en cada noticia → llama a `/api/resumir` → Claude API
- [ ] Resumen en 2-3 líneas en español
- [ ] Badge de sentiment: 🟢 positivo / 🔴 negativo / 🟡 neutral para Argentina

### M5.3.2 — Búsqueda histórica
- [ ] Guardar noticias en DB (modelo `Noticia` en Prisma)
- [ ] Búsqueda por fecha, fuente, categoría
- [ ] "Noticias del día que el dólar subió X%"

### M5.3.3 — Newsletter / Export
- [ ] Botón para exportar las noticias del día a PDF o texto
- [ ] Resumen diario de las 10 noticias más importantes

---

## Orden de ejecución sugerido

```
SEMANA 1:
└── M5.1.1 — Refactor NewsFeed (UI + filtros + buscador)

SEMANA 2:
└── M5.1.2 — Mejorar API (más fuentes + categorización + deduplicación)

SEMANA 3:
└── M5.1.3 — Unificar NEWS + GEOPOLÍTICA

SEMANA 4:
└── M5.2.1 — Ticker tape de noticias

SEMANA 5:
└── M5.2.2 — Breaking news detector

SEMANA 6+:
└── M5.3.x — Features avanzados con IA
```

---

## Archivos relevantes del proyecto

| Archivo | Descripción |
|---|---|
| `src/components/dashboard/news-feed.tsx` | Componente principal de noticias |
| `src/components/dashboard/tab-geopolitica.tsx` | Tab geopolítica con categorías |
| `src/app/api/rss-news/route.ts` | API RSS noticias locales |
| `src/app/api/geopolitica/route.ts` | API RSS noticias internacionales |
| `src/app/api/noticias/[ticker]/route.ts` | API noticias por ticker |
| `src/app/api/rss-proxy/route.ts` | Proxy para feeds RSS externos |

---

## Reglas de trabajo

1. **Siempre trabajar en la rama `lorenzo`** — nunca pushear a `main`
2. Mantener la **estética Bloomberg** (dark, tablas, colores del proyecto)
3. Cada nuevo endpoint debe tener **caché** implementado
4. Los componentes nuevos deben ser **consistentes** con el resto del panel
5. Abrir **Pull Request** cuando una fase esté completa para revisión del equipo

---

*roadmap generado para Lorenzo — rama `lorenzo` — EconData_argy*
