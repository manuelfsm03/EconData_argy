"""
api/services/agente_tools.py
---------------------------------------------------------
Tools del agente + system prompt.

Las tools reusan los endpoints existentes del backend. En vez de hacer
HTTP al propio servicio (lo que duplicaría latencia), importamos los
handlers directamente y los llamamos como funciones Python.

ADAPTAR EN EL REPO:
  Cuando Claude Code implemente esto en el repo real, debe ajustar los
  imports y las llamadas a los handlers reales de cada router.
  Los nombres `_call_endpoint_*` de acá son placeholders.
---------------------------------------------------------
"""

import time
from datetime import date


# ═══════════════════════════════════════════════════════════
#   System prompt del agente
# ═══════════════════════════════════════════════════════════

def build_system_prompt() -> str:
    today = date.today().isoformat()
    return f"""Sos el asistente de análisis de EconData, un dashboard argentino de economía y mercados. Hoy es {today}.

Respondés preguntas sobre economía, mercados y datos argentinos usando exclusivamente las herramientas disponibles.

HERRAMIENTAS:
- get_dolar_bcra: tipos de cambio (oficial, blue, MEP, CCL, mayorista, cripto, tarjeta), reservas BCRA, riesgo país, BADLAR
- get_macro: EMAE, IPI manufacturero, ISAC construcción, balanza comercial
- get_ipc: IPC nacional histórico, núcleo, alimentos, regulados, ponderaciones de canasta
- get_deuda_fiscal: última licitación del Tesoro, resultado primario/financiero, recaudación
- get_mundo: mercados globales (S&P 500, Nasdaq, Merval, commodities, FX, crypto, UST 10Y)
- get_noticias: noticias económicas filtradas del apartado de noticias

REGLAS DURAS:
1. Si necesitás datos, LLAMÁ a la tool correspondiente. Nunca inventes cifras ni fechas.
2. Si la tool no devuelve info relevante, decilo: "No encuentro ese dato en el dashboard ahora".
3. Siempre citá fuente y fecha al final: [Fuente, fecha].
4. Separá HECHOS de INTERPRETACIÓN: "El dato muestra X" vs "Esto podría implicar Y".
5. NO das recomendaciones de inversión personalizadas. Si preguntan "¿compro X?", aclarás: "No doy recomendaciones personalizadas".
6. Respuestas CORTAS: máximo 4 oraciones salvo que pidan profundizar.
7. Si la pregunta no es sobre economía/finanzas/mercado argentino o contexto global relevante, decí: "Me ocupo solo de economía y mercados. ¿Te puedo ayudar con algo del dashboard?" y no llames tools.
8. Neutral políticamente. No uses adjetivos cargados. Describí hechos.

TONO: directo, técnico pero claro, rioplatense. Sin emojis. Sin "¡Excelente pregunta!".

Si una tool falla o devuelve vacío, no insistas; avisá al usuario."""


# ═══════════════════════════════════════════════════════════
#   Definición de tools
# ═══════════════════════════════════════════════════════════

TOOLS = [
    {
        "name": "get_dolar_bcra",
        "description": (
            "Obtiene tipos de cambio actuales (dólar oficial, blue, MEP, CCL, mayorista, cripto, tarjeta), "
            "brecha cambiaria, reservas internacionales del BCRA, riesgo país (EMBI) y tasa BADLAR. "
            "Usar cuando el usuario pregunte por cotizaciones, brecha, reservas, riesgo país o tasas de política monetaria."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_macro",
        "description": (
            "Obtiene indicadores de actividad económica argentina: EMAE (nivel, variación mensual e interanual), "
            "IPI Manufacturero, ISAC Construcción, Balanza Comercial (exportaciones, importaciones, saldo). "
            "Usar cuando pregunten por nivel de actividad, crecimiento, PBI proxy, exportaciones/importaciones."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "indicador": {
                    "type": "string",
                    "enum": ["emae", "ipi", "isac", "balanza", "todos"],
                    "description": "Indicador específico. 'todos' para traer el panel completo.",
                },
            },
        },
    },
    {
        "name": "get_ipc",
        "description": (
            "Obtiene datos de IPC argentino: variación mensual e interanual, núcleo, alimentos, "
            "regulados, estacionales. Usar para preguntas sobre inflación."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "vista": {
                    "type": "string",
                    "enum": ["actual", "historico", "ponderaciones"],
                    "description": "'actual' = último dato, 'historico' = serie, 'ponderaciones' = comparativo canastas.",
                },
            },
        },
    },
    {
        "name": "get_deuda_fiscal",
        "description": (
            "Obtiene info de deuda y fiscal: última licitación del Tesoro (adjudicado, vencimientos, "
            "rollover %, instrumentos), resultado primario, financiero, recaudación. "
            "Usar cuando pregunten por licitaciones, superávit/déficit, recaudación, deuda."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_mundo",
        "description": (
            "Obtiene cotizaciones de mercados globales: S&P 500, Nasdaq, Dow, Merval, VIX, "
            "soja, maíz, trigo, petróleo, oro, EUR/USD, BRL/USD, CNY/USD, UST 10Y, Bitcoin, Ethereum. "
            "Usar cuando pregunten por mercados internacionales, commodities, monedas globales, crypto."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "tickers": {
                    "type": "string",
                    "description": "Tickers específicos separados por coma. Omitir para traer todos.",
                },
            },
        },
    },
    {
        "name": "get_noticias",
        "description": (
            "Obtiene noticias económicas argentinas filtradas del apartado de noticias del dashboard. "
            "Usar cuando el usuario pregunte qué pasó, qué dijo alguien, qué medida se tomó, novedades recientes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "filter": {
                    "type": "string",
                    "description": "Texto para filtrar (ej: 'dólar', 'BCRA', 'inflación'). Omitir para traer todas.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Cantidad de noticias. Default 10, máx 20.",
                },
            },
        },
    },
]


# ═══════════════════════════════════════════════════════════
#   Ejecutor
# ═══════════════════════════════════════════════════════════

async def execute_tool(name: str, args: dict) -> dict:
    """
    Despacha la tool al handler correspondiente.
    Retorna {ok: bool, data?: ..., error?: str}.
    """
    try:
        handlers = {
            "get_dolar_bcra": _call_dolar_bcra,
            "get_macro": _call_macro,
            "get_ipc": _call_ipc,
            "get_deuda_fiscal": _call_deuda_fiscal,
            "get_mundo": _call_mundo,
            "get_noticias": _call_noticias,
        }
        handler = handlers.get(name)
        if not handler:
            return {"ok": False, "error": f"Tool desconocida: {name}"}

        data = await handler(args or {})
        return {"ok": True, "data": data}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


# ─────────────────────────────────────────────────────────
# Handlers — Claude Code tiene que reemplazarlos con los
# imports reales de los routers del repo.
#
# EJEMPLO de cómo quedaría cada uno después de leer el repo:
#
#   from api.routers.economia import get_dolar as _handler_dolar
#   async def _call_dolar_bcra(args):
#       return await _handler_dolar()  # o como se llame el handler
#
# Lo importante es NO hacer llamada HTTP al propio servicio.
# ─────────────────────────────────────────────────────────

async def _call_dolar_bcra(args: dict):
    """
    TODO (Claude Code): importar handler real de api/routers/economia.py
    Puede combinar datos de múltiples endpoints si el dashboard los tiene
    separados (ej: dolar + bcra).
    """
    raise NotImplementedError("Implementar con handler real de economia.py")


async def _call_macro(args: dict):
    """TODO (Claude Code): handler real de api/routers/macro_ar.py"""
    raise NotImplementedError("Implementar con handler real de macro_ar.py")


async def _call_ipc(args: dict):
    """TODO (Claude Code): handler real de ipc en api/routers/macro_ar.py"""
    raise NotImplementedError("Implementar con handler real de ipc")


async def _call_deuda_fiscal(args: dict):
    """TODO (Claude Code): handler real de api/routers/deuda.py"""
    raise NotImplementedError("Implementar con handler real de deuda.py")


async def _call_mundo(args: dict):
    """TODO (Claude Code): handler real de api/services/yfinance_service.py"""
    raise NotImplementedError("Implementar con handler real de mundo")


async def _call_noticias(args: dict):
    """
    TODO (Claude Code): handler real de api/routers/noticias.py
    Respetar los parámetros filter y limit.
    """
    raise NotImplementedError("Implementar con handler real de noticias.py")
