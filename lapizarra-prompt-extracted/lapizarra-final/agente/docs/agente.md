# docs/agente.md — Diseño técnico del agente conversacional

## Resumen

Chat conversacional embebido en el apartado de noticias de EconData_argy.
Responde preguntas sobre dólar, inflación, macro, mercados globales y
noticias usando los endpoints existentes del backend como tools.

## Arquitectura

```
Usuario
  │
  └─> ChatAgente.js (frontend React via CDN)
        │
        └─> POST /api/agente/chat { message, model }
              │
              ├─ Rate limit (Supabase, 3/24hs por IP)
              ├─ Loop de tool use (max 4 iteraciones):
              │    ├─ get_dolar_bcra  → economia.py handler
              │    ├─ get_macro       → macro_ar.py handler
              │    ├─ get_ipc         → macro_ar.py handler (vista IPC)
              │    ├─ get_deuda_fiscal → deuda.py handler
              │    ├─ get_mundo       → yfinance_service.py
              │    └─ get_noticias    → noticias.py handler
              ├─ Log en Supabase (fire-and-forget)
              └─ Respuesta JSON al frontend
```

## Modelos soportados

| ID | Proveedor | Modelo | Uso |
|---|---|---|---|
| `haiku-4.5` | Anthropic | claude-haiku-4-5-20251001 | Default, mejor calidad |
| `gemini-flash` | Google | gemini-2.0-flash | Backup, más barato |

Precios (actualizados abr 2026, verificar al productivizar):
- Haiku 4.5: $1/MTok input, $5/MTok output
- Gemini Flash: $0.10/MTok input, $0.40/MTok output

## Tools — mapeo a endpoints reales

| Tool | Endpoint(s) del repo | Observaciones |
|---|---|---|
| `get_dolar_bcra` | `/api/economia/ar/dolar` + `/api/economia/ar/bcra` | Combinar ambos en un objeto |
| `get_macro` | `/api/macro/emae`, `/api/macro/ipi`, `/api/macro/balanza` | Selector por arg `indicador` |
| `get_ipc` | `/api/macro/ipc/*` | Selector por arg `vista` |
| `get_deuda_fiscal` | `/api/deuda/licitaciones` + `/api/macro/fiscal` | Combinar |
| `get_mundo` | handler de `yfinance_service.py` | Filtro opcional por `tickers` |
| `get_noticias` | `/api/noticias/*` | Debe soportar filter y limit |

**Regla clave:** las tools importan los handlers y los llaman como funciones
Python. NO hacen llamadas HTTP al mismo backend (evita latencia y timeouts).

## Rate limit

3 consultas / 24hs por IP. Contador vive en Supabase (query a `chat_events`
por `ip_hash` con `status='ok'` en la ventana).

**Fail-open:** si Supabase falla, permitimos la consulta (no queremos caerle
al usuario por un problema de nuestra infra). Los abuses eventuales los
detectamos en análisis posterior.

## Observabilidad

Cada interacción se loguea en `chat_events` de Supabase con:
- `ip_hash` (SHA-256 + salt, no reversible)
- `message_text` (la pregunta real, para análisis)
- `message_hash` (para agrupar preguntas repetidas)
- `model_id`, tokens in/out, costo estimado
- `tool_calls` (JSON array con latencia por tool)
- `status`: ok | error | rate_limited | timeout
- `latency_ms_total`, `latency_ms_llm`, `latency_ms_tools`

## Panel admin

Ruta: `/admin.html` (o el patrón que use el repo).
Auth: password simple en header `x-admin-password`.

Muestra:
- KPIs (consultas, usuarios únicos, costo, latencia media)
- Comparativa por modelo (volumen, p50/p95, costo)
- Distribución horaria (hora AR)
- Tools más usadas y % de falla
- Top 15 preguntas más frecuentes
- 20 errores más recientes

## System prompt del agente

Ver `agente_tools.py::build_system_prompt()`. Puntos clave:
1. Solo usa datos de las tools
2. Cita fuente y fecha siempre
3. Separa hechos de interpretación
4. No da recomendaciones de inversión personalizadas
5. Respuestas cortas (máx 4 oraciones)
6. Rechaza off-topic

## Límites conocidos

- **Timeout Vercel Hobby**: 10s total. Con 4 iteraciones de tool use + LLM
  lento puede rozarlo. Mitigación: `LLM_TIMEOUT_SEC=8.0` y `max_iterations=4`.
  Si se vuelve un problema, bajar a 3 iteraciones o pasar a Vercel Pro (60s).
- **Supabase free tier**: 500 MB DB. A ~1 KB por evento = 500k eventos.
  Alcanza y sobra para el MVP.
- **Rate limit sin Redis**: cada request hace query a Supabase para contar.
  Overhead ~30-50ms por request. Aceptable; si crece, migrar a Upstash Redis.

## Variables de entorno

Agregar a Vercel:

| Variable | Uso |
|---|---|
| `ANTHROPIC_API_KEY` | Haiku 4.5 |
| `GEMINI_API_KEY` | Gemini Flash |
| `SUPABASE_URL` | Proyecto de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Escritura a chat_events (keep secret) |
| `IP_HASH_SALT` | Random string para hashear IPs |
| `ADMIN_PASSWORD` | Password del panel /admin |

## Tests manuales sugeridos

Después del deploy inicial, probar:

1. "¿a cuánto está el dólar CCL?" → debe llamar `get_dolar_bcra`
2. "¿cuánto fue la última inflación?" → debe llamar `get_ipc`
3. "¿cómo está el S&P 500?" → debe llamar `get_mundo`
4. "resumime las últimas noticias del BCRA" → debe llamar `get_noticias` con filter
5. "¿qué pasó con el EMAE y cómo cerró el Merval?" → debe encadenar `get_macro` + `get_mundo`
6. "¿me conviene comprar AL30?" → debe rechazar recomendación personalizada
7. "¿qué comés hoy?" → debe redirigir off-topic sin llamar tools
8. 4ta consulta en 24hs → debe devolver 429

## Evolución posterior (fuera de scope del MVP)

- Streaming de respuestas (SSE)
- Historial persistente de conversación
- Más tools (ej: comparador histórico, alertas)
- Alertas automáticas por costo/errores
- A/B testing entre Haiku y Gemini con scoring
