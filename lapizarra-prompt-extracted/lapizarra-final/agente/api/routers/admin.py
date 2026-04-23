"""
api/routers/admin.py
---------------------------------------------------------
Endpoints admin: métricas del agente.

Auth: header `x-admin-password` contra env var ADMIN_PASSWORD.

Un endpoint: /api/admin/metrics?days=7
---------------------------------------------------------
"""

import os
import httpx
from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timezone, timedelta
from collections import defaultdict

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _require_admin(request: Request):
    expected = os.environ.get("ADMIN_PASSWORD")
    if not expected:
        raise HTTPException(status_code=500, detail="ADMIN_PASSWORD no configurado")
    provided = request.headers.get("x-admin-password", "")
    if provided != expected:
        raise HTTPException(status_code=401, detail="No autorizado")


@router.get("/metrics")
async def metrics(request: Request, days: int = 7):
    _require_admin(request)

    days = max(1, min(days, 90))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Fetch todos los eventos de la ventana. Si crece mucho, optimizar con
    # consultas más específicas o una materialized view.
    rows = await _fetch_events(since)

    return {
        "window_days": days,
        "since": since,
        "totals": _compute_totals(rows),
        "by_model": _compute_by_model(rows),
        "by_hour": _compute_by_hour(rows),
        "top_questions": _compute_top_questions(rows),
        "tool_stats": _compute_tool_stats(rows),
        "recent_errors": _recent_errors(rows),
    }


async def _fetch_events(since_iso: str) -> list[dict]:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    async with httpx.AsyncClient(timeout=5.0) as client:
        res = await client.get(
            f"{base}/rest/v1/chat_events",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            params={
                "select": "*",
                "created_at": f"gte.{since_iso}",
                "order": "created_at.desc",
                "limit": "5000",
            },
        )
        res.raise_for_status()
        return res.json()


# ─────────────────────────────────────────────────────────
# Agregaciones
# ─────────────────────────────────────────────────────────

def _compute_totals(rows: list[dict]) -> dict:
    ok = [r for r in rows if r["status"] == "ok"]
    return {
        "total_queries": len(rows),
        "ok_queries": len(ok),
        "errors": sum(1 for r in rows if r["status"] == "error"),
        "rate_limited": sum(1 for r in rows if r["status"] == "rate_limited"),
        "unique_users": len({r["ip_hash"] for r in rows if r.get("ip_hash")}),
        "cost_usd_total": round(sum(float(r.get("cost_usd") or 0) for r in rows), 4),
        "tokens_in_total": sum(r.get("tokens_input") or 0 for r in rows),
        "tokens_out_total": sum(r.get("tokens_output") or 0 for r in rows),
        "avg_latency_ms": (
            round(sum(r["latency_ms_total"] for r in ok) / len(ok))
            if ok else 0
        ),
    }


def _compute_by_model(rows: list[dict]) -> list[dict]:
    grouped = defaultdict(lambda: {"total": 0, "ok": 0, "cost_usd": 0.0, "latencies": []})
    for r in rows:
        mid = r.get("model_id")
        if not mid:
            continue
        g = grouped[mid]
        g["total"] += 1
        if r["status"] == "ok":
            g["ok"] += 1
            g["latencies"].append(r["latency_ms_total"])
        g["cost_usd"] += float(r.get("cost_usd") or 0)

    out = []
    for mid, g in grouped.items():
        out.append({
            "model_id": mid,
            "total": g["total"],
            "ok": g["ok"],
            "cost_usd": round(g["cost_usd"], 4),
            "p50_latency_ms": _percentile(g["latencies"], 0.5),
            "p95_latency_ms": _percentile(g["latencies"], 0.95),
        })
    return out


def _compute_by_hour(rows: list[dict]) -> list[dict]:
    TZ_OFFSET_HOURS = -3  # Argentina = UTC-3
    buckets = [0] * 24
    for r in rows:
        try:
            dt = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
            hour = (dt.hour + TZ_OFFSET_HOURS) % 24
            buckets[hour] += 1
        except Exception:
            continue
    return [{"hour": h, "count": c} for h, c in enumerate(buckets)]


def _compute_top_questions(rows: list[dict]) -> list[dict]:
    grouped = {}
    for r in rows:
        if r["status"] != "ok":
            continue
        mh = r.get("message_hash")
        if not mh:
            continue
        if mh not in grouped:
            grouped[mh] = {
                "example": r.get("message_text", ""),
                "count": 0,
                "unique_users": set(),
            }
        grouped[mh]["count"] += 1
        grouped[mh]["unique_users"].add(r.get("ip_hash"))

    out = [
        {
            "example": g["example"],
            "count": g["count"],
            "unique_users": len(g["unique_users"]),
        }
        for g in grouped.values()
    ]
    out.sort(key=lambda x: x["count"], reverse=True)
    return out[:15]


def _compute_tool_stats(rows: list[dict]) -> list[dict]:
    stats = defaultdict(lambda: {"total": 0, "ok": 0, "fail": 0, "latencies": []})
    for r in rows:
        for tc in r.get("tool_calls") or []:
            s = stats[tc["tool"]]
            s["total"] += 1
            if tc.get("ok"):
                s["ok"] += 1
            else:
                s["fail"] += 1
            if tc.get("latency_ms"):
                s["latencies"].append(tc["latency_ms"])

    return [
        {
            "tool": name,
            "total": s["total"],
            "ok": s["ok"],
            "fail": s["fail"],
            "pct_fail": round(s["fail"] * 100 / s["total"], 1) if s["total"] else 0,
            "avg_latency_ms": (
                round(sum(s["latencies"]) / len(s["latencies"]))
                if s["latencies"] else None
            ),
        }
        for name, s in stats.items()
    ]


def _recent_errors(rows: list[dict]) -> list[dict]:
    errors = [r for r in rows if r["status"] == "error"]
    errors.sort(key=lambda r: r["created_at"], reverse=True)
    return [
        {
            "created_at": r["created_at"],
            "model_id": r.get("model_id"),
            "message_text": r.get("message_text"),
            "error_message": r.get("error_message"),
            "latency_ms_total": r.get("latency_ms_total"),
        }
        for r in errors[:20]
    ]


def _percentile(values: list[int], p: float) -> int | None:
    if not values:
        return None
    s = sorted(values)
    idx = min(int(len(s) * p), len(s) - 1)
    return s[idx]
