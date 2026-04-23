"""
api/services/agente_llm.py
---------------------------------------------------------
Router unificado de LLMs con tool use.

Soporta:
  - Claude Haiku 4.5 via Anthropic API
  - Gemini 2.0 Flash via Google Generative Language API

Interfaz pública:
  run_agent(model_id, system_prompt, user_message, tools, max_iterations)
  → dict con keys: answer, tool_calls, iterations, tokens_input, tokens_output

Usa httpx directo (sin SDK) para no sumar dependencias pesadas.
---------------------------------------------------------
"""

import os
import time
import json
import httpx

from api.services.agente_tools import execute_tool

MAX_OUTPUT_TOKENS = 500
LLM_TIMEOUT_SEC = 8.0  # Vercel Hobby cap 10s total → dejamos margen

MODELS = {
    "haiku-4.5": {
        "label": "Claude Haiku 4.5",
        "provider": "anthropic",
        "model": "claude-haiku-4-5-20251001",
    },
    "gemini-flash": {
        "label": "Gemini 2.0 Flash",
        "provider": "google",
        "model": "gemini-2.0-flash",
    },
}


async def run_agent(
    model_id: str,
    system_prompt: str,
    user_message: str,
    tools: list,
    max_iterations: int = 4,
) -> dict:
    cfg = MODELS.get(model_id)
    if not cfg:
        raise ValueError(f"Modelo desconocido: {model_id}")

    if cfg["provider"] == "anthropic":
        return await _run_anthropic(cfg, system_prompt, user_message, tools, max_iterations)
    if cfg["provider"] == "google":
        return await _run_google(cfg, system_prompt, user_message, tools, max_iterations)
    raise ValueError(f"Provider no soportado: {cfg['provider']}")


# ═══════════════════════════════════════════════════════════
#   ANTHROPIC (Claude Haiku 4.5)
# ═══════════════════════════════════════════════════════════

async def _run_anthropic(cfg, system_prompt, user_message, tools, max_iterations):
    anthropic_tools = [
        {"name": t["name"], "description": t["description"], "input_schema": t["input_schema"]}
        for t in tools
    ]

    messages = [{"role": "user", "content": user_message}]
    tool_calls_log = []
    total_input = 0
    total_output = 0
    iterations = 0

    async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SEC) as client:
        while iterations < max_iterations:
            iterations += 1

            res = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": os.environ["ANTHROPIC_API_KEY"],
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": cfg["model"],
                    "max_tokens": MAX_OUTPUT_TOKENS,
                    "system": system_prompt,
                    "tools": anthropic_tools,
                    "messages": messages,
                },
            )
            res.raise_for_status()
            data = res.json()

            # Acumular tokens
            usage = data.get("usage", {})
            total_input += usage.get("input_tokens", 0)
            total_output += usage.get("output_tokens", 0)

            # Respuesta final
            if data.get("stop_reason") == "end_turn" or not _has_tool_use(data.get("content", [])):
                answer = "\n".join(
                    b["text"] for b in data.get("content", []) if b.get("type") == "text"
                ).strip()
                return {
                    "answer": answer,
                    "tool_calls": tool_calls_log,
                    "iterations": iterations,
                    "tokens_input": total_input,
                    "tokens_output": total_output,
                }

            # Ejecutar tool_use
            messages.append({"role": "assistant", "content": data["content"]})

            tool_results = []
            for block in data["content"]:
                if block.get("type") != "tool_use":
                    continue

                t0 = time.time()
                result = await execute_tool(block["name"], block.get("input", {}))
                latency = int((time.time() - t0) * 1000)

                tool_calls_log.append({
                    "tool": block["name"],
                    "args": block.get("input", {}),
                    "ok": result["ok"],
                    "latency_ms": latency,
                })

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block["id"],
                    "content": json.dumps(result["data"] if result["ok"] else {"error": result["error"]}),
                    "is_error": not result["ok"],
                })

            messages.append({"role": "user", "content": tool_results})

    return {
        "answer": "Tuve problemas para completar la respuesta. Probá reformulando la pregunta.",
        "tool_calls": tool_calls_log,
        "iterations": iterations,
        "tokens_input": total_input,
        "tokens_output": total_output,
    }


def _has_tool_use(content):
    return any(b.get("type") == "tool_use" for b in content)


# ═══════════════════════════════════════════════════════════
#   GOOGLE (Gemini Flash)
# ═══════════════════════════════════════════════════════════

async def _run_google(cfg, system_prompt, user_message, tools, max_iterations):
    google_tools = [{
        "functionDeclarations": [
            {
                "name": t["name"],
                "description": t["description"],
                "parameters": _to_gemini_schema(t["input_schema"]),
            }
            for t in tools
        ]
    }]

    contents = [{"role": "user", "parts": [{"text": user_message}]}]
    tool_calls_log = []
    total_input = 0
    total_output = 0
    iterations = 0

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{cfg['model']}:generateContent"

    async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SEC) as client:
        while iterations < max_iterations:
            iterations += 1

            res = await client.post(
                url,
                params={"key": os.environ["GEMINI_API_KEY"]},
                headers={"Content-Type": "application/json"},
                json={
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
                    "contents": contents,
                    "tools": google_tools,
                    "generationConfig": {
                        "maxOutputTokens": MAX_OUTPUT_TOKENS,
                        "temperature": 0.3,
                    },
                },
            )
            res.raise_for_status()
            data = res.json()

            usage = data.get("usageMetadata", {})
            total_input += usage.get("promptTokenCount", 0)
            total_output += usage.get("candidatesTokenCount", 0)

            candidate = (data.get("candidates") or [{}])[0]
            parts = candidate.get("content", {}).get("parts", [])
            function_calls = [p for p in parts if "functionCall" in p]

            if not function_calls:
                answer = "\n".join(p["text"] for p in parts if "text" in p).strip()
                return {
                    "answer": answer,
                    "tool_calls": tool_calls_log,
                    "iterations": iterations,
                    "tokens_input": total_input,
                    "tokens_output": total_output,
                }

            contents.append({"role": "model", "parts": parts})

            function_response_parts = []
            for part in function_calls:
                fc = part["functionCall"]
                name = fc["name"]
                args = fc.get("args", {})

                t0 = time.time()
                result = await execute_tool(name, args)
                latency = int((time.time() - t0) * 1000)

                tool_calls_log.append({
                    "tool": name,
                    "args": args,
                    "ok": result["ok"],
                    "latency_ms": latency,
                })

                function_response_parts.append({
                    "functionResponse": {
                        "name": name,
                        "response": result["data"] if result["ok"] else {"error": result["error"]},
                    }
                })

            contents.append({"role": "user", "parts": function_response_parts})

    return {
        "answer": "Tuve problemas para completar la respuesta. Probá reformulando la pregunta.",
        "tool_calls": tool_calls_log,
        "iterations": iterations,
        "tokens_input": total_input,
        "tokens_output": total_output,
    }


def _to_gemini_schema(schema):
    """Gemini no acepta `default` y algunos otros campos. Los stripeamos."""
    if not isinstance(schema, dict):
        return schema
    out = {k: v for k, v in schema.items() if k != "default"}
    if "properties" in out:
        out["properties"] = {
            k: _to_gemini_schema(v) for k, v in out["properties"].items()
        }
    return out
