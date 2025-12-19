"""FastAPI entrypoint for exchanging workflow ids for ChatKit client secrets."""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any, Mapping, Sequence

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

DEFAULT_CHATKIT_BASE = "https://api.mtda.cloud/api/ai"
SESSION_COOKIE_NAME = "chatkit_session_id"
SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30  # 30 days

app = FastAPI(title="Managed ChatKit Session API")


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if not key:
            continue
        os.environ.setdefault(key, value)


_BASE_DIR = Path(__file__).resolve().parents[1]
load_env_file(_BASE_DIR / ".env")
load_env_file(_BASE_DIR / ".env.local")

def is_prod() -> bool:
    env = (os.getenv("ENVIRONMENT") or os.getenv("NODE_ENV") or "").lower()
    return env == "production"

def cors_config() -> tuple[list[str], str | None, bool]:
    raw = os.getenv("CORS_ALLOW_ORIGINS")
    if raw:
        if raw.strip() == "*":
            return ([], ".*", False)
        origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
        return (origins, None, True)

    if is_prod():
        return ([], None, False)

    # Dev default: allow Vite dev servers on localhost/127.0.0.1 any port.
    return ([], r"^https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?$", True)


_cors_origins, _cors_origin_regex, _cors_allow_credentials = cors_config()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_origin_regex,
    allow_credentials=_cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> Mapping[str, str]:
    return {"status": "ok"}


@app.post("/api/create-session")
async def create_session(request: Request) -> JSONResponse:
    """Exchange a workflow id for a ChatKit client secret."""
    api_key = os.getenv("XPERTAI_API_KEY")
    if not api_key:
        return respond({"error": "Missing XPERTAI_API_KEY environment variable"}, 500)

    body = await read_json_body(request)
    assistant_id = resolve_assistant_id(body)
    
    if not assistant_id:
        return respond({"error": "Missing assistant id"}, 400)

    user_id, cookie_value = resolve_user(request.cookies)
    api_base = chatkit_api_base()

    try:
        async with httpx.AsyncClient(base_url=api_base, timeout=10.0) as client:
            upstream = await client.post(
                "/v1/chatkit/sessions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "OpenAI-Beta": "chatkit_beta=v1",
                    "Content-Type": "application/json",
                },
                json={"assistant": {"id": assistant_id}, "user": user_id},
            )
    except httpx.RequestError as error:
        return respond(
            {"error": f"Failed to reach ChatKit API: {error}"},
            502,
            cookie_value,
        )

    payload = parse_json(upstream)
    if not upstream.is_success:
        message = None
        if isinstance(payload, Mapping):
            message = payload.get("error")
        message = message or upstream.reason_phrase or "Failed to create session"
        return respond({"error": message}, upstream.status_code, cookie_value)

    client_secret = None
    expires_after = None
    if isinstance(payload, Mapping):
        client_secret = payload.get("client_secret")
        expires_after = payload.get("expires_after")

    if not client_secret:
        return respond(
            {"error": "Missing client secret in response"},
            502,
            cookie_value,
        )

    return respond(
        {"client_secret": client_secret, "expires_after": expires_after},
        200,
        cookie_value,
    )


@app.post("/api/chat")
async def chat(request: Request) -> JSONResponse:
    """Simple chat endpoint for the demo UI (server-side API key)."""
    api_key = os.getenv("XPERTAI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return respond(
            {"error": "Missing XPERTAI_API_KEY (or OPENAI_API_KEY) environment variable"},
            500,
        )

    body = await read_json_body(request)
    messages = body.get("messages")
    if not isinstance(messages, Sequence):
        return respond({"error": "Missing messages"}, 400)

    model = os.getenv("CHAT_MODEL") or os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
    api_base = chatkit_api_base()

    try:
        async with httpx.AsyncClient(base_url=api_base, timeout=30.0) as client:
            upstream = await client.post(
                "/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": body.get("temperature", 0.7),
                },
            )
    except httpx.RequestError as error:
        return respond({"error": f"Failed to reach model API: {error}"}, 502)

    payload = parse_json(upstream)
    if not upstream.is_success:
        message = None
        if isinstance(payload, Mapping):
            message = payload.get("error")
        message = message or upstream.reason_phrase or "Failed to generate response"
        return respond({"error": message}, upstream.status_code)

    content = None
    if isinstance(payload, Mapping):
        choices = payload.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, Mapping):
                message = first.get("message")
                if isinstance(message, Mapping):
                    content = message.get("content")

    if not content:
        return respond({"error": "Missing assistant content in response"}, 502)

    return respond({"content": content}, 200)


def respond(
    payload: Mapping[str, Any], status_code: int, cookie_value: str | None = None
) -> JSONResponse:
    response = JSONResponse(payload, status_code=status_code)
    if cookie_value:
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=cookie_value,
            max_age=SESSION_COOKIE_MAX_AGE_SECONDS,
            httponly=True,
            samesite="lax",
            secure=is_prod(),
            path="/",
        )
    return response


async def read_json_body(request: Request) -> Mapping[str, Any]:
    raw = await request.body()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, Mapping) else {}


def resolve_assistant_id(body: Mapping[str, Any]) -> str | None:
    assistant = body.get("assistant", {})
    assistant_id = None
    if isinstance(assistant, Mapping):
        assistant_id = assistant.get("id")
    assistant_id = assistant_id or body.get("assistantId")
    env_assistant = os.getenv("CHATKIT_ASSISTANT_ID") or os.getenv(
        "VITE_CHATKIT_ASSISTANT_ID"
    )
    if not assistant_id and env_assistant:
        assistant_id = env_assistant
    if assistant_id and isinstance(assistant_id, str) and assistant_id.strip():
        return assistant_id.strip()
    return None


def resolve_user(cookies: Mapping[str, str]) -> tuple[str, str | None]:
    existing = cookies.get(SESSION_COOKIE_NAME)
    if existing:
        return existing, None
    user_id = str(uuid.uuid4())
    return user_id, user_id


def chatkit_api_base() -> str:
    return (
        os.getenv("CHATKIT_API_BASE")
        or os.getenv("VITE_CHATKIT_API_BASE")
        or DEFAULT_CHATKIT_BASE
    )


def parse_json(response: httpx.Response) -> Mapping[str, Any]:
    try:
        parsed = response.json()
        return parsed if isinstance(parsed, Mapping) else {}
    except (json.JSONDecodeError, httpx.DecodingError):
        return {}
