# Agente Conversacional — EconData_argy

Paquete completo para implementar el agente en el repo
[manuelfsm03/EconData_argy](https://github.com/manuelfsm03/EconData_argy).

Diseñado específicamente para el stack real del proyecto:
**FastAPI + React via CDN + Babel Standalone**.

## Cómo usar este paquete

### Flujo recomendado

1. **Crear la rama**
   ```bash
   cd EconData_argy/
   git checkout main
   git pull
   git checkout -b feature/agente-noticias
   ```

2. **Abrir Claude Code en la rama**
   Desde la raíz del repo, abrí una nueva conversación de Claude Code.

3. **Pegar el prompt maestro**
   Abrí `prompt/PROMPT_MAESTRO.md` de este paquete y pegá todo su contenido
   como primer mensaje en Claude Code.

4. **Fase 0: dejar que investigue**
   Claude Code va a leer el repo primero y reportarte qué encontró.
   Confirmá o corregí antes de que empiece a escribir código.

5. **Fase 1: backend**
   Claude Code va a crear los archivos Python. Usá los archivos de este
   paquete como referencia si tiene dudas — están en `agente/api/`.

6. **Fase 2: frontend**
   El componente React. Referencia en `agente/js/`.

7. **Fase 3: config y deploy**
   Variables de entorno, Supabase, documentación.

## Estructura del paquete

```
lapizarra-final/
├── prompt/
│   └── PROMPT_MAESTRO.md        ← Lo que le pegás a Claude Code
│
└── agente/                       ← Archivos de referencia
    ├── api/
    │   ├── routers/
    │   │   ├── agente.py         # Endpoint /api/agente/chat
    │   │   └── admin.py          # Endpoint /api/admin/metrics
    │   └── services/
    │       ├── agente_llm.py     # Router unificado LLMs
    │       ├── agente_tools.py   # Tools + system prompt
    │       └── observability.py  # Logging + rate limit
    ├── js/
    │   ├── components/
    │   │   └── ChatAgente.js     # Componente del chat
    │   └── chat-styles.css       # Estilos (append a styles.css)
    ├── sql/
    │   └── 001_schema.sql        # Schema Supabase
    └── docs/
        └── agente.md             # Doc técnico completo
```

## Decisiones importantes ya tomadas

| Decisión | Elección | Por qué |
|---|---|---|
| Stack backend | FastAPI (respeta el existente) | No duplicar stacks |
| Frontend pattern | React via CDN + Babel Standalone | Igual al resto del repo |
| LLM default | Claude Haiku 4.5 | Mejor análisis en español |
| LLM alternativo | Gemini 2.0 Flash | Gratis, backup |
| Storage de logs | Supabase | SQLite en /tmp se pierde en cold starts |
| Storage de cache | SQLite en /tmp (ya existente) | No tocar lo que funciona |
| Rate limit | 3/24hs por IP | MVP para testing interno |
| HTTP client | httpx (ya en el repo) | No sumar dependencias |

## Setup de Supabase (5 minutos)

1. Entrar a [supabase.com](https://supabase.com), crear proyecto
2. Project Settings → API → copiar `URL` y `service_role` key
3. SQL Editor → pegar `agente/sql/001_schema.sql` → Run
4. Guardar las variables para pegarlas en Vercel después

## Variables de entorno necesarias

```bash
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
IP_HASH_SALT=string-random-largo    # generar: openssl rand -hex 32
ADMIN_PASSWORD=elegi-algo-dificil
```

## Preguntas frecuentes

**¿Este paquete se sube al repo?**
No. Es material de referencia. Claude Code lee el prompt maestro y los
archivos, y los usa como guía para escribir el código real en el repo.

**¿Por qué los archivos Python tienen `NotImplementedError`?**
Los handlers de las tools (`_call_dolar_bcra`, etc.) están marcados como
TODO porque necesitan los nombres reales de las funciones del repo, que
Claude Code va a ver cuando lea `api/routers/economia.py` etc. en la
Fase 0.

**¿Qué pasa si Claude Code hace algo que no me gusta?**
Parás la conversación, le decís qué cambiar, y seguís. El prompt está
diseñado para que pare entre fases, así podés reviewar.

**¿Puedo saltearme la Fase 0?**
No. El prompt le dice explícitamente a Claude Code que investigue primero
y espere tu OK. Si el repo cambió desde que yo lo leí (2026-04-20), la
Fase 0 detecta las discrepancias antes de que se pongan a escribir código
equivocado.

## Qué falta después de este MVP

Priorizado:

1. **Conectar endpoints reales** — lo van a resolver durante este sprint.
   Los `NotImplementedError` desaparecen cuando Claude Code lee los
   routers existentes.
2. **Testing automatizado** con los 10 queries de `docs/agente.md`
3. **Hardening anti prompt injection** — validación extra del mensaje
4. **Alertas de costo** — cron que chequee gasto diario
5. **Streaming de respuestas** — mejor UX pero requiere cambios en FE y BE

## Soporte

Si Claude Code se traba o pregunta algo que no está en el prompt, volvé a
esta conversación y lo destrabamos.
