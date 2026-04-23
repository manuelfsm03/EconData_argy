# La Pizarra — Guía para el Agente de IA

Este archivo es leído automáticamente por Claude Code y otros agentes de IA.
Contiene tareas pendientes, decisiones de arquitectura y contexto del proyecto.

---

## 📋 RESUMEN DE CAMBIOS — rama `feature/pivot`

Esta rama parte de `feature/agente-noticias` y agrega dos bloques principales:

### 1. Agente conversacional Pizi (usuario final)
Asistente flotante disponible en todas las secciones del dashboard.

- **Botón flotante** (`floating-agent.tsx`) — círculo naranja animado abajo a la derecha, abre/cierra el chat con Escape
- **Chat UI** (`chat-agente.tsx`) — burbujas, sugerencias clickeables, card de rate limit con opción de suscribirse
- **Backend** (`agente-llm.ts`, `agente-tools.ts`, `agente-observability.ts`) — tool use con Claude Haiku 4.5 y Gemini Flash, 6 tools (dólar, IPC, macro, fiscal, mundo, noticias), rate limit 3/día por IP con anti-burst en memoria
- **Seguridad** — filtro de prompt injection (10 patrones), session_id sanitizado, IPs hasheadas SHA-256
- **Página de suscripción** (`/suscripcion`) — 3 tiers (Gratis/Colaborador USD 3/Pro USD 8), tabla comparativa, FAQ

### 2. Panel Admin — Agentes internos
Panel protegido con login + TOTP para gestión interna del dashboard.

- **`/admin`** — Hub central con estado de todos los agentes y orquestador blindado
- **`/admin/login`** — Cookie httpOnly 8hs, middleware protege `/admin/*`
- **`/admin/totp-setup`** — QR para Microsoft/Google Authenticator
- **`/admin/completitud`** — 14 checks en paralelo: detecta datos vacíos, hardcodeados o desactualizados por endpoint; sección "Actualizar" con scrapers individuales
- **`/admin/monitor`** — Historial de runs en Supabase, botón scraping inteligente
- **Orquestador blindado** — flujo: Preview (dry-run) → token de sesión → aprobación con código TOTP del teléfono → ejecución. Principio de cuatro ojos
- **Scraping inteligente** (`/api/admin/scraping-agent`) — corre solo los scrapers necesarios según urgencia detectada por completitud

### 3. Sección PIVOT — Graficador de datos
Nueva sección en el dashboard para análisis y visualización de series económicas.

- **31 series disponibles** del dashboard (macro, precios, cambiario, mercados, BCRA) via `/api/pivot`
- **Dos modos**: Simple (click para seleccionar) y Ejes X/Y (drag & drop)
- **5 tipos de gráfico**: Línea, Área, Barra, Scatter (con regresión lineal), Densidad
- **Transformaciones por serie**: Base 100, Var%, YoY%, Media Móvil 3/12p, Acumulado 12m
- **Doble eje Y**, grosor de línea, color picker, puntos visibles por serie
- **Panel estadístico**: min/max/promedio/mediana/desvío, correlación de Pearson automática entre 2 series
- **Zoom/Brush** — selector de rango temporal en el gráfico
- **Exportar**: CSV (con transformaciones aplicadas) y PNG
- **Carga de CSV propio** — parser client-side con auditor automático (8 checks: duplicados, outliers, gaps, valores nulos, rango de fechas, etc.)
- **Pizi en PIVOT** (`/api/pivot/suggest`) — sin rate limit de usuario, sugiere 3 análisis completos (series + tipo de gráfico + explicación económica) con botón "▶ Aplicar y graficar"

### Archivos nuevos clave
| Archivo | Descripción |
|---------|-------------|
| `src/middleware.ts` | Protege `/admin/*` con cookie de sesión |
| `src/app/api/pivot/route.ts` | Sirve series normalizadas para PIVOT |
| `src/app/api/pivot/suggest/route.ts` | Sugerencias de análisis vía LLM (sin rate limit usuario) |
| `src/components/dashboard/tab-pivot.tsx` | Componente PIVOT completo |
| `src/components/dashboard/floating-agent.tsx` | Botón flotante Pizi |
| `src/app/admin/page.tsx` | Hub central de agentes |
| `src/app/api/admin/orchestrator/` | Orquestador con preview + approve TOTP |
| `src/app/api/admin/completitud/route.ts` | 14 checks de calidad de datos |
| `src/app/api/admin/monitor/route.ts` | Monitor con historial Supabase |
| `src/app/api/admin/scraping-agent/route.ts` | Scraping inteligente por urgencia |
| `sql/002_monitor.sql` | Tabla `monitor_runs` — **ejecutar en Supabase** |
| `CLAUDE.md` | Este archivo — documentación para agentes de IA |

---

---

## ⚡ TAREAS PENDIENTES DE DEVOPS (leer antes de deployar)

### 1. Supabase — Tabla `monitor_runs`
El Agente Monitor guarda historial en Supabase pero la tabla aún no existe en producción.

**Acción:** Ir a Supabase → SQL Editor y ejecutar:
```
sql/002_monitor.sql
```

### 2. Vercel — Variables de entorno a agregar

| Variable | Valor | Para qué |
|----------|-------|----------|
| `CRON_SECRET` | cualquier string seguro | Autenticar llamadas del cron de Vercel |
| `TOTP_SECRET` | generado en `/admin/totp-setup` | Autenticador del teléfono (ver paso 3) |

**Acción:** Vercel → Settings → Environment Variables → agregar ambas.

### 3. Configurar TOTP — Microsoft/Google Authenticator

El orquestador requiere aprobación con código de 6 dígitos del teléfono (cambia cada 30s).

**Pasos (una sola vez):**
1. Deployar la app y entrar a `/admin/totp-setup` con sesión admin
2. Escanear el QR con **Microsoft Authenticator** o Google Authenticator
3. La app crea una cuenta llamada **"La Pizarra — lapizarra-admin"**
4. Copiar el `TOTP_SECRET` que aparece en pantalla
5. Agregarlo en Vercel como `TOTP_SECRET=<valor>`

**Para aprobar una orquestación:**
- Admin 1 hace click en "VER PREVIEW" → ve resumen de qué está roto y qué se haría
- El sistema genera un token de sesión (ej: `A3F9-B2C1`) válido 10 minutos
- Admin 1 comparte ese token con Admin 2 (Slack, WhatsApp, etc.)
- Admin 2 abre el Authenticator en su teléfono → obtiene el código de 6 dígitos
- Admin 2 ingresa ambos (token + código TOTP) → autoriza la ejecución

### 4. Vercel — Configurar Cron Job

Agregar al `vercel.json` (o crearlo en la raíz):
```json
{
  "crons": [
    {
      "path": "/api/admin/monitor",
      "schedule": "0 * * * *"
    }
  ]
}
```
Corre el Agente Monitor automáticamente cada hora.
Vercel lo llama con `Authorization: Bearer CRON_SECRET`.

---

## Stack

- **Framework:** Next.js 14 App Router + TypeScript
- **Base de datos:** Prisma + SQLite (dev) / Supabase (observabilidad y monitor)
- **Deploy:** Vercel Hobby — Lambda max **10 segundos** (tener en cuenta en rutas nuevas)
- **LLMs:** Claude Haiku 4.5 (Anthropic) + Gemini 2.0 Flash (Google)
- **Auth admin:** Cookie httpOnly + TOTP (otplib)

---

## Arquitectura de Agentes

### Agente de cara al usuario — Pizi
Asistente conversacional flotante disponible en todas las secciones del dashboard.

| Archivo | Descripción |
|---------|-------------|
| `src/components/dashboard/floating-agent.tsx` | Botón flotante + panel del chat |
| `src/components/dashboard/chat-agente.tsx` | UI del chat (burbujas, sugerencias, rate limit card) |
| `src/lib/agente-tools.ts` | System prompt, definición de tools, handlers de cada tool |
| `src/lib/agente-llm.ts` | Loop de tool use para Anthropic y Gemini |
| `src/lib/agente-observability.ts` | Rate limit (Supabase + memoria), logging, hash de IPs |
| `src/app/api/agente/chat/route.ts` | Endpoint POST del chat |

**Configuración clave:**
- Rate limit: 3 consultas/día por IP · anti-burst 5s en memoria
- Modelos: `haiku-4.5` (default) · `gemini-flash`
- System prompt: `buildSystemPrompt()` en `agente-tools.ts`
- Sugerencias rápidas: array `SUGGESTIONS` en `chat-agente.tsx`
- Página de suscripción: `/suscripcion` (pasarela de pago **pendiente**)

### Agentes internos — Panel Admin

Todos protegidos por middleware (`src/middleware.ts`) que redirige a `/admin/login`.

| Ruta UI | Ruta API | Descripción |
|---------|----------|-------------|
| `/admin` | — | **HUB CENTRAL**: estado de todos los agentes + orquestador |
| `/admin/login` | `/api/admin/login` | Login con cookie httpOnly (8hs) |
| `/admin/totp-setup` | `/api/admin/totp-setup` | Setup y verificación del QR para Authenticator |
| `/admin/completitud` | `/api/admin/completitud` | 14 checks en paralelo — detecta datos vacíos/hardcodeados/desactualizados |
| `/admin/monitor` | `/api/admin/monitor` | Historial de runs guardados en Supabase |
| — | `/api/admin/scraping-agent` | Scraping inteligente: solo corre los scrapers necesarios según urgencia |
| — | `/api/admin/orchestrator` | **Orquestador completo** (requiere TOTP) |
| — | `/api/admin/orchestrator/preview` | Dry-run: qué haría el orquestador sin ejecutar nada |
| — | `/api/admin/orchestrator/approve` | Valida TOTP y ejecuta el orquestador |
| — | `/api/admin/metrics` | Métricas de Pizi: queries, tokens, costos por modelo |

### Flujo de orquestación blindado

```
Admin 1: VER PREVIEW
    ↓
Completitud (14 checks, solo lectura)
    ↓ genera token A3F9-B2C1 (válido 10 min)
Admin 1 → comparte token → Admin 2
    ↓
Admin 2: ingresa token + código TOTP del teléfono
    ↓ validación: token no expirado + token no usado + TOTP correcto
EJECUCIÓN AUTORIZADA
    ├── Monitor (detecta + logea en Supabase)
    ├── Scraping Inteligente (si hay problemas, orden: error > empty > stale)
    └── Verificación final (confirma que se resolvió)
```

---

## Seguridad

| Capa | Mecanismo |
|------|-----------|
| Páginas `/admin/*` | Middleware Next.js → redirige a login si no hay cookie |
| Cookie de sesión | httpOnly · secure en prod · SameSite=lax · 8hs |
| `/api/scrape/[source]` | Requiere `x-admin-password` o cookie de sesión |
| Orquestador | Preview + token de sesión + TOTP (principio de cuatro ojos) |
| IPs de usuarios | Hasheadas con SHA-256 + salt (`IP_HASH_SALT`) antes de guardar |
| Mensajes de error | Solo se exponen detalles en `NODE_ENV=development` |
| Prompt injection | 10 patrones bloqueados antes de llegar al LLM |
| Rate limit Pizi | 3/día por IP (Supabase) + anti-burst 5s (memoria) + fail-safe si Supabase cae |

---

## Variables de entorno requeridas

```bash
# LLMs
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

# Supabase (observabilidad + monitor)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Seguridad
ADMIN_PASSWORD=...          # acceso al panel admin
IP_HASH_SALT=...            # salt para hashear IPs
TOTP_SECRET=...             # generado en /admin/totp-setup ← PENDIENTE
CRON_SECRET=...             # para el cron de Vercel ← PENDIENTE

# DB local
DATABASE_URL=file:./dev.db
PORT=3001                   # puerto local (Next.js)
```
