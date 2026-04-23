"""
api/services/observability.py
---------------------------------------------------------
Observabilidad + rate limit.

Usa Supabase para:
  1. Contador de rate limit (ventana deslizante 24hs)
  2. Log de cada interacción (chat_events)

Principios:
  - Nunca bloquea respuesta al usuario si el log falla
  - IPs hasheadas con SHA-256 + salt
  - Compatible con Vercel Lambda (stateless)
---------------------------------------------------------
"""

import os
import hashlib
import time
import httpx
from fastapi import Request

# ═══════════════════════════════════════════════════════════
#   Cliente Supabase minimalista (sin SDK, via REST API)
# ═══════════════════════════════════════════════════════════

def _supabase_url(path: str) -> str:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    return f"{base}/rest/v1/{path}"


def _supabase_headers() -> dict:
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


# ═══════════════════════════════════════════════════════════
#   Hashing
# ═══════════════════════════════════════════════════════════

def hash_ip(ip: str) -> str:
    salt = os.environ.get("IP_HASH_SALT", "lapizarra-default-salt-CAMBIAR")
    return hashlib.sha256(f"{ip}:{salt}".encode()).hexdigest()


def hash_message(text: str) -> str:
    import re
    normalized = re.sub(r"\s+", " ", text.lower().strip())
    normalized = re.sub(r"[.?!,;:]+$", "", normalized)
    return hashlib.sha256(normalized.encode()).hexdigest()


def get_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ═══════════════════════════════════════════════════════════
#   Estimación de costos
# ═══════════════════════════════════════════════════════════

PRICING = {
    "haiku-4.5": {
        "input":  1.00 / 1_000_000,   # $1.00 per MTok
        "output": 5.00 / 1_000_000,   # $5.00 per MTok
    },
    "gemini-flash": {
        "input":  0.10 / 1_000_000,
        "output": 0.40 / 1_000_000,
    },
}


def estimate_cost(model_id: str, tokens_input: int, tokens_output: int) -> float | None:
    p = PRICING.get(model_id)
    if not p:
        return None
    return round(tokens_input * p["input"] + tokens_output * p["output"], 6)


# ═══════════════════════════════════════════════════════════
#   Rate limit
#
#   Implementación: cuenta eventos del ip_hash en los últimos
#   24hs con status='ok' o status='rate_limited'. Si >= max,
#   rechaza.
#
#   Ventaja de usar chat_events directamente: un solo storage.
#   Desventaja: query por cada request. Para el MVP está bien;
#   si escala, pasar a un Redis dedicado.
# ═══════════════════════════════════════════════════════════

async def check_and_consume_rate_limit(ip: str, max_per_day: int) -> dict:
    ip_h = hash_ip(ip)

    # Contar eventos del usuario en últimas 24hs (status ok)
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(
                _supabase_url("chat_events"),
                headers={**_supabase_headers(), "Prefer": "count=exact"},
                params={
                    "select": "id",
                    "ip_hash": f"eq.{ip_h}",
                    "status": "eq.ok",
                    "created_at": f"gte.{_iso_24h_ago()}",
                    "limit": "1",
                },
            )
            content_range = res.headers.get("content-range", "*/0")
            current = int(content_range.split("/")[-1])
    except Exception:
        # Si Supabase falla, NO bloqueamos al usuario (fail-open)
        current = 0

    if current >= max_per_day:
        return {
            "allowed": False,
            "remaining": 0,
            "resets_in_seconds": 24 * 60 * 60,  # aproximación
        }

    return {
        "allowed": True,
        "remaining": max_per_day - current - 1,  # -1 porque esta va a contar
        "resets_in_seconds": 24 * 60 * 60,
    }


def _iso_24h_ago() -> str:
    from datetime import datetime, timezone, timedelta
    return (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()


# ═══════════════════════════════════════════════════════════
#   Logging de eventos
# ═══════════════════════════════════════════════════════════

async def log_chat_event(event: dict) -> None:
    """
    Inserta un evento en chat_events.
    Fire-and-forget: cualquier excepción se swallowea.
    """
    try:
        ip = event.pop("ip", "")
        message_text = event.get("message_text", "")

        payload = {
            "ip_hash": hash_ip(ip) if ip else "",
            "session_id": event.get("session_id"),
            "message_text": message_text[:1000],
            "message_hash": hash_message(message_text) if message_text else "",
            "message_len": len(message_text),
            "model_id": event.get("model_id"),
            "model_version": event.get("model_version"),
            "tool_calls": event.get("tool_calls", []),
            "iterations": event.get("iterations", 1),
            "latency_ms_total": event.get("latency_ms_total"),
            "latency_ms_llm": event.get("latency_ms_llm"),
            "latency_ms_tools": event.get("latency_ms_tools"),
            "tokens_input": event.get("tokens_input"),
            "tokens_output": event.get("tokens_output"),
            "cost_usd": estimate_cost(
                event.get("model_id", ""),
                event.get("tokens_input") or 0,
                event.get("tokens_output") or 0,
            ),
            "status": event.get("status", "ok"),
            "error_message": event.get("error_message"),
            "answer_len": event.get("answer_len"),
        }

        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                _supabase_url("chat_events"),
                headers=_supabase_headers(),
                json=payload,
            )
    except Exception as e:
        # Nunca rompemos la respuesta al usuario por un error de logging
        print(f"[observability] log error: {e}")
