# PROMPT MAESTRO — Feature: Agente de análisis conversacional

> **Instrucciones:** pegá este mensaje completo como primer prompt en una nueva
> conversación de Claude Code, **parado en la rama `feature/agente-noticias`**
> del repo EconData_argy.

---

## Contexto del proyecto

Estás trabajando en **EconData_argy** (https://github.com/manuelfsm03/EconData_argy),
un dashboard económico argentino con backend FastAPI + frontend React via CDN
con Babel Standalone. El stack real es:

- **Backend:** Python/FastAPI en `/api/index.py` + routers en `/api/routers/`
- **Frontend:** React 18 vía CDN, Babel Standalone transpila JSX en el browser
- **Deploy:** Vercel Hobby, lambdas Python con 10s timeout
- **Cache:** SQLite en `/tmp` (efímero, se pierde entre cold starts)

Leé el `README.md` del repo para el detalle completo antes de tocar nada.

---

## Qué vamos a construir

Un **agente conversacional** embebido en el apartado de noticias del dashboard
que responde preguntas de los usuarios usando **tool use** (function calling)
sobre los endpoints que ya existen en el backend.

Ejemplo de interacción:
- Usuario: "¿a cuánto está el dólar CCL?"
- Agente: llama a `/api/economia/ar/dolar` → responde con cita y fecha
- Usuario: "¿qué pasó con el IPC?"
- Agente: llama a `/api/macro/ipc/historico` → responde con el último dato

### Características

- **2 modelos soportados**: Claude Haiku 4.5 (default) y Gemini 2.0 Flash
- **Rate limit**: 3 consultas por IP cada 24hs (server-side)
- **Tool use**: el agente elige qué endpoint consultar según la pregunta
- **Observabilidad**: cada interacción se loguea en Supabase (tokens, latencia,
  costo, tool calls) con un panel interno en `/admin/metricas`
- **Reglas duras**: nunca da recomendaciones de inversión personalizadas,
  siempre cita fuente y fecha, separa hechos de interpretación

---

## Fase 0 — Investigación (HACÉ ESTO PRIMERO)

Antes de escribir UNA LÍNEA de código, ejecutá estos pasos y reportame
qué encontraste:

1. Leé el `README.md` completo
2. Listá el contenido de `api/routers/` y dame los paths exactos de los
   endpoints existentes (ej: `GET /api/economia/ar/dolar`, etc.)
3. Leé `api/routers/noticias.py` y decime qué endpoint expone y qué devuelve
4. Leé `api/index.py` para entender cómo se registran los routers y si hay
   middleware global (CORS, auth, etc.)
5. Leé `api/services/cache.py` para entender el patrón de cache
6. Listá `js/components/sections/` para ver el patrón de componentes
7. Leé uno de los componentes de sección (ej: `SeccionDolar.js`) para
   entender cómo escriben React sin build step (Babel Standalone + scope
   global)
8. Verificá si existe algo relacionado a "chat", "agente", "IA" o "LLM" en
   el código actual — no queremos duplicar trabajo

Cuando termines el reporte, **parate y esperá mi OK** para avanzar.
Si algo de lo que encontraste contradice supuestos de este prompt
(ej: el framework no es FastAPI), decímelo antes de seguir.

---

## Fase 1 — Backend del agente

Crear los siguientes archivos en el repo:

### `api/routers/agente.py` (NUEVO)

Endpoint POST `/api/agente/chat` que recibe `{ message, model, session_id? }`,
aplica rate limit, corre un loop de tool use contra los endpoints existentes,
loguea en Supabase, y devuelve la respuesta.

Diseño:
- Loop de tool use con máximo 4 iteraciones
- 2 proveedores: Anthropic Claude y Google Gemini
- Tools: `get_dolar_bcra`, `get_macro`, `get_ipc`, `get_deuda_fiscal`,
  `get_mundo`, `get_noticias` — cada una reusa un endpoint existente
- Rate limit: 3 consultas/24hs por IP (usá el cache SQLite que ya existe,
  o Supabase, lo que sea más simple)
- Timing: medí latencia total, del LLM y de cada tool call
- Logging no-bloqueante: si Supabase falla, la respuesta al usuario NO se afecta

### `api/services/agente_llm.py` (NUEVO)

Router unificado entre Anthropic y Google. Expone:

```python
async def run_agent(
    model_id: str,
    system_prompt: str,
    user_message: str,
    tools: list[dict],
    max_iterations: int = 4,
) -> AgentResult
```

`AgentResult` incluye: `answer`, `tool_calls` (con latencia por tool),
`iterations`, `tokens_input`, `tokens_output`.

Los dos proveedores devuelven tokens en sus respuestas — capturalos.

### `api/services/agente_tools.py` (NUEVO)

Define las tools del agente en formato neutral (dict con `name`,
`description`, `input_schema`) y un `execute_tool(name, args)` que las
ejecuta llamando a los endpoints existentes del repo.

**Importante:** las tools llaman a los endpoints del mismo backend. No
hace falta HTTP — podés importar directamente los handlers de los routers
existentes para evitar latencia y timeout de Vercel.

### `api/services/observability.py` (NUEVO)

- `log_chat_event(event: dict)` → inserta en tabla `chat_events` de Supabase
- `estimate_cost(model_id, tokens_in, tokens_out)` con precios actualizados
- `hash_ip(ip)` con SHA-256 + salt (privacidad)

### `api/routers/admin.py` (NUEVO)

Endpoints:
- `GET /api/admin/metrics?days=7` — agregados para el panel
- Auth: header `x-admin-password` contra env var `ADMIN_PASSWORD`

### `sql/001_schema.sql` (NUEVO, documentación)

Schema de Supabase con tabla `chat_events` + índices + materialized view
para rollups diarios. Es solo para que el usuario lo pegue en Supabase SQL
Editor.

### Registrar el router en `api/index.py`

Sumar `from api.routers import agente, admin` y `app.include_router(...)`
siguiendo el patrón de los routers existentes.

### Actualizar `api/requirements.txt`

Agregar: `anthropic`, `supabase`, `google-generativeai` (o usar httpx
directo a las APIs REST si querés menos dependencias — vos elegís).

---

## Fase 2 — Frontend del chat

### `js/components/ChatAgente.js` (NUEVO)

Componente React del chat en el mismo patrón que usan los componentes de
sección (Babel Standalone, scope global, sin imports ES6).

- Declarar el componente como `window.ChatAgente = (...)` o similar según
  el patrón de `SeccionDolar.js` que hayas leído en Fase 0
- Selector de modelo (Haiku / Gemini)
- Contador de consultas restantes
- Loading con indicador animado
- Manejo de rate limit (429) y errores
- Estilos que matcheen el look del dashboard (revisá `styles.css`)

### Integrar en la sección de noticias

Agregarlo al apartado de noticias que ya existe en el dashboard.
Ubicalo de forma natural dentro de esa sección, no como widget flotante.

### `js/components/AdminMetricas.js` (NUEVO)

Panel interno con login por password, KPIs, tabla por modelo, distribución
horaria (hora AR), tools stats, preguntas más frecuentes y errores recientes.

Ruta: `/admin.html` o ruta equivalente según el patrón del proyecto.

---

## Fase 3 — Configuración y deploy

### Variables de entorno (Vercel)

Agregar a la config de Vercel:
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `IP_HASH_SALT` (generar random)
- `ADMIN_PASSWORD` (elegir uno)

Agregar los nombres al README en la tabla "Variables de entorno".

### `vercel.json`

Verificar si hay que ajustar algo (maxDuration para el endpoint del chat
debe ser 10s, que es el límite de Hobby — si hace falta más, el agente
hay que optimizarlo para cerrar en <10s).

### Documentación

Actualizar `README.md` agregando una sección "Agente conversacional" con:
- Qué hace
- Cómo invocarlo (endpoint)
- Cómo acceder al panel admin
- Link a `docs/agente.md` para detalle técnico

Crear `docs/agente.md` con el diseño completo (tools, prompt, costos
esperados, tests manuales sugeridos).

---

## Reglas de trabajo

1. **Commits chicos y frecuentes**. Uno por fase como mínimo, idealmente
   uno por archivo importante.
2. **No tocar código del dashboard existente** más allá de lo estrictamente
   necesario. Si necesitás modificar un endpoint existente, preguntame antes.
3. **Seguir el estilo del repo**. Si los otros routers usan `async def`,
   usá `async def`. Si no tienen type hints, no los sumes. Adaptate al
   código real.
4. **Después de cada fase, parate y reportá**:
   - Qué archivos creaste/modificaste
   - Qué decisiones tomaste y por qué
   - Qué necesitás de mí para avanzar (variables, decisiones de UX, etc.)
5. **Si algo no cierra con el diseño propuesto**, decímelo y discutámoslo.
   Este prompt es una guía, no una sentencia.

---

## Stack fuera de duda (decidido)

- **LLMs**: Haiku 4.5 + Gemini 2.0 Flash. Anthropic key del dueño para el
  MVP interno. Gemini via Google AI Studio (free tier).
- **Observabilidad**: Supabase (Postgres hosteado, gratis). No usar SQLite
  para logs — se pierden en cold starts de Vercel.
- **Rate limit**: 3/24hs por IP. Storage para el contador: Supabase o
  el SQLite cache, lo que sea más simple en Python.
- **Seguridad del admin**: password único en env var. No necesitamos SSO.
- **IPs**: hasheadas con SHA-256 + salt antes de guardar.

---

## Cosas FUERA de scope (NO las hagas)

- Login de usuarios para el chat (usamos rate limit por IP)
- Streaming de respuestas (por ahora respuesta completa)
- Historial persistente entre sesiones del usuario
- Agregar más tools más allá de las 6 definidas
- Reescribir cualquier parte del dashboard existente
- Alertas por email/Slack (fase posterior)
- Export CSV del panel (se hace con SQL directo en Supabase)

---

## Empezá ahora

Andá directo a la **Fase 0 (investigación)** y reportame qué encontraste.
No escribas código hasta que yo confirme.
