# ROADMAP — Panel de Control Financiero & Económico AR

> criterio: máximo alpha primero. sin fechas rígidas, milestones concretos.
> equipos: **gonza + luca** (finanzas) | **juan + manu** (economía + agro) | **pipe** (noticias)
> code review: claude revisa PRs, nadie pushea directo a main.

---

## estado actual del panel

ya tenemos (funcionando):
- ✅ tipos de cambio (blue, ccl, mep, oficial, mayorista, cripto) — DolarAPI + histórico
- ✅ brecha cambiaria (todos los pares)
- ✅ inflación (IPC mensual, interanual, YTD, acumulado) — BCRA
- ✅ futuros ROFEX (precio, dev implícita, TNA) + calculadora de cobertura
- ✅ plazos fijos y tasas (badlar, TM20, depósitos 30d)
- ✅ depósitos y circulante (base monetaria, circulación)
- ✅ reservas internacionales
- ✅ market data global (S&P, etc.) — Yahoo Finance
- ✅ arbitraje scanner (MEP/CCL vs crypto)
- ✅ mercury feed (noticias research)
- ✅ noticias RSS
- ✅ estética bloomberg (dark, panels, tablas)
- ✅ scrapers: BCRA, DolarAPI, CriptoYa, Rava, FinanzasArgy, RSS
- ✅ DB con prisma/sqlite, cron de scraping

---

## FASE 1 — renta fija argentina (máximo alpha)
**equipo: TODOS (es la fase que más diferencia hace)**

nadie tiene un panel gratuito con renta fija AR bien hecha. acá es donde ganamos.

### M1.1 — bonos soberanos hard dollar (AL/GD) → **gonza + luca**
- [ ] modelo `SovereignBond` en prisma (ticker, moneda, ley, cupón, amortización, flujo de pagos, maturity)
- [ ] seed de flujos de pagos para AL29, AL30, AL35, AL41, GD29, GD30, GD35, GD41, AE38
- [ ] scraper de precios: ByMA data API o rava (cierre diario)
- [ ] cálculo: TIR, duration modificada, paridad, current yield
- [ ] vista: tabla screener estilo 1816 (ticker, precio, TIR, paridad, duration)
- [ ] vista: detalle por bono (flujo de pagos, gráfico precio histórico)

### M1.2 — curva de rendimientos soberanos → **luca + manu**
- [ ] gráfico de curva (TIR vs maturity) para HD ley local vs ley NY
- [ ] identificar bonos "baratos" (por debajo de la curva) vs "caros"
- [ ] comparativa histórica de curvas (overlay fecha anterior)

### M1.3 — lecaps y bonos tasa fija → **juan + manu**
- [ ] modelo para instrumentos pesos (lecap, boncap, etc.)
- [ ] scraper de precios desde ByMA/Rava
- [ ] cálculo: TIR, TEA, precio técnico
- [ ] tabla: todas las lecaps ordenadas por vencimiento con TIR

### M1.4 — bonos CER / dollar linked / duales → **juan + luca**
- [ ] extensión del modelo para bonos ajustables
- [ ] cálculo: TIR real (CER), breakeven de inflación, breakeven de devaluación
- [ ] vista comparativa: CER vs DL vs tasa fija (¿dónde conviene estar?)

### M1.5 — vencimientos del tesoro → **manu + gonza**
- [ ] calendario de vencimientos (mensual y diario, estilo 1816)
- [ ] monto por tipo de instrumento (CER, DL, tasa fija, HD)
- [ ] gráfico de barras de vencimientos futuros
- [ ] alerta pre-licitación

### M1.6 — ONs corporativas (stretch goal) → **luca + pipe**
- [ ] modelo para ONs (emisor, rating, cupón, maturity)
- [ ] screener básico con TIR y spread vs soberano
- [ ] datos de MAE (scraping o manual seed)

### M1.7 — riesgo país → **manu + juan**
- [ ] cálculo a partir de spread bonos AR vs treasuries
- [ ] histórico y gráfico
- [ ] comparativo regional (brasil, chile, colombia)

**fuente de ecuaciones:** excel de lauro (luca lo consigue) + lógica estándar de cálculo financiero

**en paralelo todos pueden avanzar:**
```
gonza + luca → M1.1 (soberanos HD) — es el core
juan + manu  → M1.3 (lecaps) + M1.7 (riesgo país)
luca + manu  → M1.2 (curva) apenas M1.1 tenga datos
juan + luca  → M1.4 (CER/DL) en paralelo con lecaps
manu + gonza → M1.5 (vencimientos) 
luca + pipe  → M1.6 (ONs) como stretch
```

---

## FASE 2 — economía y datos macro
**equipo: juan + manu**

### M2.1 — actividad económica
- [ ] EMAE (estimador mensual de actividad) — API min. economía
- [ ] desagregado por sector (industria, construcción, servicios)
- [ ] gráfico de evolución + variación interanual
- [ ] IPI (índice de producción industrial)

### M2.2 — sector fiscal
- [ ] resultado fiscal primario y financiero — min. economía
- [ ] ingresos vs gastos (gráfico de evolución)
- [ ] deuda pública (stock, composición por moneda, perfil de vencimientos)
- [ ] base caja vs devengado

### M2.3 — sector externo
- [ ] balanza comercial (expo vs impo) — INDEC API
- [ ] desagregado por rubro (MOA, MOI, combustibles, productos primarios)
- [ ] términos de intercambio
- [ ] tipo de cambio real multilateral (ITCRM) — BCRA

### M2.4 — mercado laboral
- [ ] empleo registrado (SIPA) — min. trabajo
- [ ] tasa de desempleo (trimestral, INDEC)
- [ ] salarios (RIPTE, CVS)

### M2.5 — indicadores líderes
- [ ] confianza del consumidor (UTDT)
- [ ] expectativas REM (BCRA) — pronósticos de consultoras
- [ ] PMI manufacturero (si hay fuente)

### M2.6 — riesgo país
- [ ] cálculo a partir de spread EMBI+ o fórmula con bonos AR vs treasuries
- [ ] histórico y gráfico
- [ ] comparativo regional (brasil, chile, colombia)

---

## FASE 3 — agro
**equipo: juan + manu (con input de luca)**

### M3.1 — precios de commodities agrícolas
- [ ] soja, trigo, maíz, girasol — CBOT (Yahoo Finance / API gratuita)
- [ ] precios locales (Bolsa de Cereales de Buenos Aires, Bolsa de Rosario)
- [ ] FOB vs FAS

### M3.2 — campaña y producción
- [ ] estimaciones de cosecha (Bolsa de Cereales BA — informe semanal)
- [ ] siembra, estado de cultivos, rindes estimados
- [ ] scraping del informe de la bolsa de cereales
- [ ] informes de Alaria Agro y Nasini (PDFs → parsing)

### M3.3 — clima zona núcleo
- [ ] precipitaciones acumuladas vs promedio histórico
- [ ] mapa de humedad / sequía (Open-Meteo API)
- [ ] correlación clima → estimación de rinde

### M3.4 — retenciones y FOB teórico
- [ ] calculadora de FOB teórico (CBOT - retenciones - gastos)
- [ ] margen bruto por hectárea estimado
- [ ] evolución del poder de compra del productor

---

## FASE 4 — acciones argentinas
**equipo: gonza + luca**

### M4.1 — panel merval
- [ ] screener de acciones BYMA (precio, variación, volumen)
- [ ] datos de cierre diario (ByMA data o rava scraping)
- [ ] merval + merval 25 + panel general
- [ ] ADRs y ratio ADR/local (CCL implícito por acción)

### M4.2 — fundamentals
- [ ] ratios: P/E, P/BV, dividend yield, EV/EBITDA
- [ ] seed manual o scraping de balances (CNV / BCBA)
- [ ] comparativo sectorial (bancos, energía, oil&gas)
- [ ] inspiración: finviz pero para AR

### M4.3 — cedears
- [ ] ratio de conversión, CCL implícito
- [ ] screener de cedears con P/E del subyacente
- [ ] comparativa cedear vs acción en NYSE

---

## FASE 5 — noticias y contenido
**equipo: pipe (con apoyo de todos)**

### M5.1 — feed de noticias mejorado
- [ ] RSS multi-fuente (ámbito, infobae economía, cronista, reuters LATAM)
- [ ] categorización automática (macro, finanzas, agro, crypto, geopolítica)
- [ ] búsqueda y filtros
- [ ] detección de duplicados

### M5.2 — cables estilo bloomberg
- [ ] timeline cronológico de noticias relevantes
- [ ] highlight de breaking news
- [ ] integración con mercury (research channels)

### M5.3 — comunidad y opinión (futuro)
- [ ] sistema de comentarios / opiniones por activo
- [ ] termómetro de sentimiento (estilo reuters consensus)
- [ ] requiere autenticación de usuarios

---

## FASE 6 — herramientas avanzadas
**equipo: todos**

### M6.1 — sintéticos de dólar (ROFEX)
- [ ] tasa implícita: vendés USD spot + comprás futuro → TNA
- [ ] tabla con todas las posiciones y su sintético
- [ ] comparativa vs badlar, lecap, plazo fijo

### M6.2 — calculadora de bonos
- [ ] input: precio de mercado → output: TIR, duration, convexity
- [ ] input: TIR objetivo → output: precio teórico
- [ ] simular escenarios (qué pasa si baja el riesgo país 100bp)

### M6.3 — input manual de precios (estilo 1816)
- [ ] para usuarios que ven precios en pantalla y quieren calcular al instante
- [ ] no depende de API — el usuario carga el precio y el sistema calcula todo
- [ ] útil cuando ByMA bloquea real-time

### M6.4 — alertas personalizables
- [ ] configurar alertas por email/telegram cuando: TIR > X%, brecha > Y%, etc.
- [ ] webhook o polling

---

## FASE 7 — infraestructura y deploy
**equipo: gonza + juan**

### M7.1 — migrar de sqlite a postgres (si escala)
- [ ] evaluar si sqlite aguanta el volumen de datos
- [ ] migrar a supabase/neon si necesario

### M7.2 — cron robusto
- [ ] scraping automático cada 5 min (mercado abierto)
- [ ] scraping diario post-cierre para históricos
- [ ] health checks y alertas si falla un scraper

### M7.3 — API pública (stretch)
- [ ] endpoints REST documentados
- [ ] rate limiting
- [ ] posible monetización

---

## fuentes de datos confirmadas

| fuente | tipo | datos | estado |
|--------|------|-------|--------|
| BCRA API | api pública | reservas, base monetaria, tasas, TC, CER, UVA | ✅ funcionando |
| DolarAPI | api pública | cotizaciones en vivo | ✅ funcionando |
| CriptoYa | api pública | crypto/ARS por exchange | ✅ funcionando |
| Rava | scraping | acciones, bonos (cierre) | ✅ scraper existe |
| FinanzasArgy | scraping | datos varios | ✅ scraper existe |
| Yahoo Finance | api | mercados globales, commodities CBOT | ✅ funcionando |
| Min. Economía | api pública | EMAE, fiscal, balanza comercial | 🔲 por integrar |
| INDEC | api/scraping | empleo, comercio exterior | 🔲 por integrar |
| ByMA Data | api (requiere key?) | precios bonos/acciones RT | 🔲 por evaluar |
| MAE | scraping | ONs, mercado secundario | 🔲 por evaluar |
| Bolsa Cereales BA | scraping | cosecha, estado cultivos | 🔲 por integrar |
| Bolsa Comercio Rosario | api/scraping | precios agro, informes | 🔲 por evaluar |
| Alaria Agro | PDF/informes | análisis agro | 🔲 manual/parsing |
| Nasini | informes | análisis agro rosario | 🔲 manual/parsing |
| Open-Meteo | api pública | clima, precipitaciones | 🔲 por integrar |

---

## reglas de trabajo

1. **branches siempre.** nadie pushea a main. claude revisa PRs.
2. **data first.** si el dato no es confiable, no lo mostramos.
3. **API > scraping > manual.** priorizar fuentes estables.
4. **estética bloomberg.** mantener consistencia visual (dark, tablas, colores).
5. **cada PR debe tener:** qué fuente de datos usa, cómo se actualiza, qué calcula.
6. **documentar ecuaciones.** cada cálculo financiero con su fórmula en comentarios.

---

## prioridad de ejecución (paralelo)

```
SEMANA 1-2:
├── gonza + luca: M1.1 (bonos soberanos) + M1.3 (lecaps)
├── juan + manu: M2.1 (actividad económica) + M2.2 (fiscal)
└── pipe: M5.1 (feed noticias mejorado)

SEMANA 3-4:
├── gonza + luca: M1.2 (curva rendimientos) + M1.5 (vencimientos tesoro)
├── juan + manu: M2.3 (sector externo) + M2.6 (riesgo país)
└── pipe: M5.2 (cables bloomberg)

SEMANA 5-6:
├── gonza + luca: M1.4 (CER/DL) + M6.1 (sintéticos)
├── juan + manu: M3.1 (commodities agro) + M3.2 (campaña)
└── todos: M6.2 (calculadora bonos) + M6.3 (input manual)

SEMANA 7+:
├── gonza + luca: FASE 4 (acciones merval)
├── juan + manu: M3.3 (clima) + M3.4 (retenciones)
└── todos: M7 (infra) + features avanzados
```

---

*última actualización: 26 feb 2026*
*repo: pushear en econ-data-argy, deploy en vercel*
