"""
Orchestrate 4 benchmark rounds by swapping tool/endpoint configs,
restarting the backend, running bench.py, and printing a summary table.

Usage:
    python run_rounds.py
"""
import os
import subprocess
import sys
import time
import textwrap
from pathlib import Path

BACKEND_DIR = Path(__file__).parent / "backend"
TOOLS_DIR = BACKEND_DIR / "app/agents/tools"
CHAT_EP   = BACKEND_DIR / "app/api/v1/endpoints/chat.py"
MAIN_PY   = BACKEND_DIR / "app/main.py"

# ── Tool file contents ────────────────────────────────────────────────────────

BASH_SYNC = '''\
import subprocess

from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig

from app.agents.tools.sandbox_manager import exec_bash_in_sandbox, get_thread_id, mask_real_paths


@tool
def bash(command: str, label: str, config: RunnableConfig) -> str:
    """Execute a bash command inside the sandbox and return stdout.

    Three persistent directories are available:
    - /workspace  : working directory (default cwd)
    - /output     : save files here to show them to the user
    - /upload     : user-uploaded files available for reading

    Args:
        command: Bash command to execute.
        label: Brief human-readable description shown to the user (e.g. "Running fibonacci script").
    """
    thread_id = get_thread_id(config)
    try:
        result = exec_bash_in_sandbox(thread_id, command)
    except FileNotFoundError:
        return "Error: Docker is not available on this system."
    except subprocess.TimeoutExpired:
        return "Error: command timed out (60s limit)."

    output = ""
    if result.stdout.strip():
        output += mask_real_paths(result.stdout.strip(), thread_id)
    if result.returncode != 0 and result.stderr.strip():
        stderr = mask_real_paths(result.stderr.strip(), thread_id)
        output += f"\\nStderr:\\n{stderr}" if output else f"Stderr:\\n{stderr}"
    if result.returncode != 0 and not output:
        output = f"Command exited with code {result.returncode}"
    return output or "(no output)"
'''

BASH_ASYNC = '''\
import asyncio
import subprocess

from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig

from app.agents.tools.sandbox_manager import exec_bash_in_sandbox, get_thread_id, mask_real_paths


@tool
async def bash(command: str, label: str, config: RunnableConfig) -> str:
    """Execute a bash command inside the sandbox and return stdout.

    Three persistent directories are available:
    - /workspace  : working directory (default cwd)
    - /output     : save files here to show them to the user
    - /upload     : user-uploaded files available for reading

    Args:
        command: Bash command to execute.
        label: Brief human-readable description shown to the user (e.g. "Running fibonacci script").
    """
    thread_id = get_thread_id(config)
    try:
        result = await asyncio.to_thread(exec_bash_in_sandbox, thread_id, command)
    except FileNotFoundError:
        return "Error: Docker is not available on this system."
    except subprocess.TimeoutExpired:
        return "Error: command timed out (60s limit)."

    output = ""
    if result.stdout.strip():
        output += mask_real_paths(result.stdout.strip(), thread_id)
    if result.returncode != 0 and result.stderr.strip():
        stderr = mask_real_paths(result.stderr.strip(), thread_id)
        output += f"\\nStderr:\\n{stderr}" if output else f"Stderr:\\n{stderr}"
    if result.returncode != 0 and not output:
        output = f"Command exited with code {result.returncode}"
    return output or "(no output)"
'''

WEB_SEARCH_SYNC = '''\
from langchain_core.tools import tool
from tavily import TavilyClient

from app.core.config import settings
from app.agents.messages import WebSearchMsg


@tool
def web_search(query: str, label: str) -> str:
    """Search the internet for current information.
    Use a single, specific query. Call this tool at most once or twice per user request.

    Args:
        query: Search query.
        label: Brief human-readable description shown to the user.
    """
    client = TavilyClient(api_key=settings.TAVILY_API_KEY)
    response = client.search(query=query, max_results=5, include_answer=True)

    lines = []
    answer = response.get("answer", "")
    if answer:
        lines.append(f"**Direct answer:** {answer}\\n")
    results = response.get("results", [])
    if not results:
        return WebSearchMsg.NO_RESULTS if not lines else "\\n".join(lines).strip()
    for r in results:
        lines.append(f"**{r[\'title\']}**")
        lines.append(r["url"])
        if r.get("content"):
            lines.append(r["content"])
        lines.append("")
    return "\\n".join(lines).strip()
'''

WEB_SEARCH_ASYNC = '''\
from langchain_core.tools import tool
from tavily import AsyncTavilyClient

from app.core.config import settings
from app.agents.messages import WebSearchMsg


@tool
async def web_search(query: str, label: str) -> str:
    """Search the internet for current information.
    Use a single, specific query. Call this tool at most once or twice per user request.

    Args:
        query: Search query.
        label: Brief human-readable description shown to the user.
    """
    client = AsyncTavilyClient(api_key=settings.TAVILY_API_KEY)
    response = await client.search(query=query, max_results=5, include_answer=True)

    lines = []
    answer = response.get("answer", "")
    if answer:
        lines.append(f"**Direct answer:** {answer}\\n")
    results = response.get("results", [])
    if not results:
        return WebSearchMsg.NO_RESULTS if not lines else "\\n".join(lines).strip()
    for r in results:
        lines.append(f"**{r[\'title\']}**")
        lines.append(r["url"])
        if r.get("content"):
            lines.append(r["content"])
        lines.append("")
    return "\\n".join(lines).strip()
'''

WEB_FETCH_SYNC = '''\
import httpx
from markdownify import markdownify
from langchain_core.tools import tool


@tool
def web_fetch(url: str, label: str) -> str:
    """Fetch the content of a web page and return it as markdown.

    Args:
        url: URL to fetch.
        label: Brief human-readable description shown to the user.
    """
    try:
        with httpx.Client(follow_redirects=True, timeout=15) as client:
            response = client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; JarvisBot/1.0)"})
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        return f"Error: HTTP {e.response.status_code} for {url}"
    except httpx.RequestError as e:
        return f"Error: Could not fetch {url} — {e}"

    content_type = response.headers.get("content-type", "")
    text = markdownify(response.text, strip=["script", "style"]) if "text/html" in content_type else response.text
    if len(text) > 20000:
        text = text[:20000] + "\\n\\n[...content truncated...]"
    return text.strip()
'''

WEB_FETCH_ASYNC = '''\
import httpx
from markdownify import markdownify
from langchain_core.tools import tool


@tool
async def web_fetch(url: str, label: str) -> str:
    """Fetch the content of a web page and return it as markdown.

    Args:
        url: URL to fetch.
        label: Brief human-readable description shown to the user.
    """
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            response = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; JarvisBot/1.0)"})
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        return f"Error: HTTP {e.response.status_code} for {url}"
    except httpx.RequestError as e:
        return f"Error: Could not fetch {url} — {e}"

    content_type = response.headers.get("content-type", "")
    text = markdownify(response.text, strip=["script", "style"]) if "text/html" in content_type else response.text
    if len(text) > 20000:
        text = text[:20000] + "\\n\\n[...content truncated...]"
    return text.strip()
'''

CHAT_ASYNC = '''\
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatRequest, ResumeRequest, AVAILABLE_MODELS
from app.services.chat_service import chat_service
from app.db import repository
from app.db.connection import get_pool

router = APIRouter()


@router.get("/models")
async def list_models():
    return AVAILABLE_MODELS


@router.post("/stream")
async def chat_stream(request: ChatRequest, req: Request):
    graph = req.app.state.graph
    pool = get_pool()
    await repository.touch_conversation(pool, request.thread_id)
    return StreamingResponse(
        chat_service.stream(request.thread_id, request.content, graph, request.thinking_effort, request.model),
        media_type="text/event-stream",
    )


@router.post("/resume")
async def chat_resume(request: ResumeRequest, req: Request):
    graph = req.app.state.graph
    return StreamingResponse(
        chat_service.resume(request.thread_id, request.decision, graph),
        media_type="text/event-stream",
    )
'''

CHAT_SYNC = '''\
import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatRequest, ResumeRequest, AVAILABLE_MODELS
from app.services.chat_service import chat_service
from app.db import repository
from app.db.connection import get_pool

router = APIRouter()


@router.get("/models")
async def list_models():
    return AVAILABLE_MODELS


@router.post("/stream")
def chat_stream(request: ChatRequest, req: Request):
    graph = req.app.state.graph
    loop = req.app.state.event_loop
    pool = get_pool()

    async def _collect():
        await repository.touch_conversation(pool, request.thread_id)
        chunks = []
        async for chunk in chat_service.stream(
            request.thread_id, request.content, graph, request.thinking_effort, request.model
        ):
            chunks.append(chunk)
        return chunks

    chunks = asyncio.run_coroutine_threadsafe(_collect(), loop).result()
    return StreamingResponse(iter(chunks), media_type="text/event-stream")


@router.post("/resume")
def chat_resume(request: ResumeRequest, req: Request):
    graph = req.app.state.graph
    loop = req.app.state.event_loop

    async def _collect():
        chunks = []
        async for chunk in chat_service.resume(request.thread_id, request.decision, graph):
            chunks.append(chunk)
        return chunks

    chunks = asyncio.run_coroutine_threadsafe(_collect(), loop).result()
    return StreamingResponse(iter(chunks), media_type="text/event-stream")
'''

# ── Round definitions ─────────────────────────────────────────────────────────

ROUNDS = [
    {
        "label": "R1: async endpoint + sync tools",
        "bash":       BASH_SYNC,
        "web_search": WEB_SEARCH_SYNC,
        "web_fetch":  WEB_FETCH_SYNC,
        "chat":       CHAT_ASYNC,
        "event_loop": False,
    },
    {
        "label": "R2: async endpoint + async tools",
        "bash":       BASH_ASYNC,
        "web_search": WEB_SEARCH_ASYNC,
        "web_fetch":  WEB_FETCH_ASYNC,
        "chat":       CHAT_ASYNC,
        "event_loop": False,
    },
    {
        "label": "R3: async endpoint + partial async (web async, bash sync)",
        "bash":       BASH_SYNC,
        "web_search": WEB_SEARCH_ASYNC,
        "web_fetch":  WEB_FETCH_ASYNC,
        "chat":       CHAT_ASYNC,
        "event_loop": False,
    },
    {
        "label": "R4: sync endpoint + sync tools",
        "bash":       BASH_SYNC,
        "web_search": WEB_SEARCH_SYNC,
        "web_fetch":  WEB_FETCH_SYNC,
        "chat":       CHAT_SYNC,
        "event_loop": True,
    },
]

# ── Helpers ───────────────────────────────────────────────────────────────────

MAIN_WITH_LOOP = '''\
    app.state.graph = build_graph(checkpointer=checkpointer)
    app.state.event_loop = asyncio.get_event_loop()
    cleanup_task = asyncio.create_task(_sandbox_cleanup_loop())'''

MAIN_WITHOUT_LOOP = '''\
    app.state.graph = build_graph(checkpointer=checkpointer)
    cleanup_task = asyncio.create_task(_sandbox_cleanup_loop())'''


def apply_config(round_cfg: dict):
    (TOOLS_DIR / "bash.py").write_text(round_cfg["bash"])
    (TOOLS_DIR / "web_search.py").write_text(round_cfg["web_search"])
    (TOOLS_DIR / "web_fetch.py").write_text(round_cfg["web_fetch"])
    CHAT_EP.write_text(round_cfg["chat"])

    main_text = MAIN_PY.read_text()
    if round_cfg["event_loop"]:
        main_text = main_text.replace(MAIN_WITHOUT_LOOP, MAIN_WITH_LOOP)
    else:
        main_text = main_text.replace(MAIN_WITH_LOOP, MAIN_WITHOUT_LOOP)
    MAIN_PY.write_text(main_text)


def kill_server():
    subprocess.run("fuser -k 8000/tcp 2>/dev/null; true", shell=True)
    time.sleep(2)


def start_server():
    env = os.environ.copy()
    env["LLM_CACHE"] = "false"
    proc = subprocess.Popen(
        ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=BACKEND_DIR,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # Wait until server is ready
    for _ in range(30):
        time.sleep(2)
        r = subprocess.run(
            ["curl", "-sf", "http://localhost:8000/api/v1/chat/models"],
            capture_output=True,
        )
        if r.returncode == 0:
            return proc
    raise RuntimeError("Server failed to start")


def run_bench(label: str) -> str:
    result = subprocess.run(
        [sys.executable, "bench.py", label],
        cwd=Path(__file__).parent,
        capture_output=True,
        text=True,
        timeout=600,
    )
    return result.stdout + result.stderr


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    all_output = []
    for i, round_cfg in enumerate(ROUNDS, 1):
        label = round_cfg["label"]
        print(f"\n[{i}/4] Configuring: {label}", flush=True)
        apply_config(round_cfg)
        kill_server()
        print(f"[{i}/4] Starting server...", flush=True)
        proc = start_server()
        print(f"[{i}/4] Running benchmark...", flush=True)
        out = run_bench(label)
        print(out, flush=True)
        all_output.append(out)
        proc.terminate()

    # Restore to async tools + async endpoint (current recommended config)
    apply_config(ROUNDS[1])  # R2: async tools
    print("\n✓ Restored to async tools + async endpoint")
    print("\n" + "="*55)
    print("  DONE — see results above for each round")
    print("="*55)


if __name__ == "__main__":
    main()
