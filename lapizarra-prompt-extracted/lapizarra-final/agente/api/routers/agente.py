"""
api/routers/agente.py
---------------------------------------------------------
Endpoint conversacional del agente de análisis.

Diseño:
  - POST /api/agente/chat recibe {message, model, session_id?}
  - Aplica rate limit (3/24hs por IP, usando Supabase)
  - Corre loop de tool use contra los routers existentes del backend
  - Loguea cada interacción en Supabase (no-bloqueante)
  - Devuelve {answer, remaining, model_used, tool_calls, iterations}

Referencia de implementación — Claude Code puede adaptarlo al estilo real
del repo después de leer los otros routers.
---------------------------------------------------------
"""

import os
import time
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

from api.services.agente_llm import run_agent, MODELS
from api.services.agente_tools import TOOLS, build_system_prompt
from api.services.observability import (
    log_chat_event,
    check_and_consume_rate_limit,
    get_client_ip,
)

router = APIRouter(prefix="/api/agente", tags=["agente"])

MAX_QUERIES_PER_DAY = 3
MAX_MESSAGE_LEN = 500


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE_LEN)
    model: str = Field(default="haiku-4.5")
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    remaining: int
    model_used: str
    tool_calls: list
    iterations: int


@router.post("/chat")
async def chat(req: ChatRequest, request: Request):
    t_start = time.time()
    ip = get_client_ip(request)

    # Validación de modelo
    if req.model not in MODELS:
        valid = ", ".join(MODELS.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Modelo inválido. Opciones: {valid}",
        )

    # Rate limit
    rl = await check_and_consume_rate_limit(ip=ip, max_per_day=MAX_QUERIES_PER_DAY)
    if not rl["allowed"]:
        # Log rate limit fire-and-forget
        await log_chat_event({
            "ip": ip,
            "session_id": req.session_id,
            "message_text": req.message,
            "model_id": req.model,
            "latency_ms_total": int((time.time() - t_start) * 1000),
            "status": "rate_limited",
        })
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Alcanzaste el límite diario de consultas",
                "remaining": 0,
                "resets_in_seconds": rl["resets_in_seconds"],
            },
        )

    # Correr el agente
    try:
        system_prompt = build_system_prompt()
        result = await run_agent(
            model_id=req.model,
            system_prompt=system_prompt,
            user_message=req.message,
            tools=TOOLS,
            max_iterations=4,
        )

        latency_ms_total = int((time.time() - t_start) * 1000)
        latency_ms_tools = sum(tc.get("latency_ms", 0) for tc in result["tool_calls"])

        # Log event (no-bloqueante: swallow exceptions)
        await log_chat_event({
            "ip": ip,
            "session_id": req.session_id,
            "message_text": req.message,
            "model_id": req.model,
            "model_version": MODELS[req.model]["model"],
            "tool_calls": result["tool_calls"],
            "iterations": result["iterations"],
            "latency_ms_total": latency_ms_total,
            "latency_ms_llm": latency_ms_total - latency_ms_tools,
            "latency_ms_tools": latency_ms_tools,
            "tokens_input": result["tokens_input"],
            "tokens_output": result["tokens_output"],
            "status": "ok",
            "answer_len": len(result["answer"]),
        })

        return ChatResponse(
            answer=result["answer"],
            remaining=rl["remaining"],
            model_used=req.model,
            tool_calls=result["tool_calls"],
            iterations=result["iterations"],
        )

    except HTTPException:
        raise
    except Exception as e:
        # Log error
        await log_chat_event({
            "ip": ip,
            "session_id": req.session_id,
            "message_text": req.message,
            "model_id": req.model,
            "latency_ms_total": int((time.time() - t_start) * 1000),
            "status": "error",
            "error_message": str(e)[:500],
        })
        raise HTTPException(
            status_code=500,
            detail={"error": "Error procesando la consulta"},
        )
