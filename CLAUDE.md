# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Jarvis is a full-stack AI chat assistant: Next.js frontend, FastAPI + LangGraph
backend, PostgreSQL (app data + LangGraph checkpoints), MinIO (generated
files), and a Docker sandbox for tool-driven code execution. See `README.md`
for the feature list and full setup instructions.

## Commands

### Infrastructure
```bash
docker compose up -d          # Postgres (5433) + MinIO (9000 API / 9001 console)
```

### Backend (from `backend/`)
```bash
make install          # create venv, install requirements.txt
make install-browser  # one-time: headless Chromium for SVG viz validation
make build-sandbox    # one-time: build the jarvis-sandbox Docker image
make migrate          # alembic upgrade head
make migration name="add_x"   # alembic revision --autogenerate
make dev              # uvicorn with --reload, port 8000
make run              # uvicorn without reload
```
There is no test suite in this repo currently (no pytest config, no test
files). Don't assume one exists.

### Frontend (from `frontend/`)
```bash
npm install
npm run dev     # port 3000
npm run build
npm run lint    # eslint
```

**Read `frontend/AGENTS.md` before touching frontend code.** The installed
Next.js is `16.2.9` (README says "15" — the AGENTS.md warning is current and
correct: treat it as a version with breaking API changes vs. training data,
and check `node_modules/next/dist/docs/` before writing Next.js-specific
code).

## Architecture

### Request flow
`POST /api/v1/chat/stream` ([backend/app/api/v1/endpoints/chat.py](backend/app/api/v1/endpoints/chat.py))
returns a `StreamingResponse` wrapping `chat_service.stream(...)`
([backend/app/services/chat_service.py](backend/app/services/chat_service.py)), which drives the LangGraph
agent (`app.state.graph`, built once at startup in `main.py`) via
`graph.astream_events(...)` and translates LangGraph's event stream into a
custom SSE protocol: `token`, `thinking_token`, `tool_start`, `tool_end`,
`tool_chunk`, `viz`, `todo_update`, `tool_limit`, `usage`, `hitl_request`, `done`, `error`.
The frontend's `use-chat.ts` hook is the sole consumer of this protocol — any
new event type must be added on both sides.

Streaming is driven inline inside the request coroutine — there is no
queue/background-task decoupling. Cancellation depends entirely on the ASGI
server observing a real client disconnect (works over a direct socket or
through a standard reverse proxy; does *not* work through an intermediary
that keeps its own upstream connection alive after the client is gone — see
`notes/req_cancel_experiments/` for a live-tested comparison and the reasoning
behind it).

### Agent graph ([backend/app/agents/graph.py](backend/app/agents/graph.py))
Built with `langchain.agents.create_agent` (LangChain/LangGraph v1 + the
`deepagents` package). Middleware stack, in order:
- `SummarizationMiddleware` — trims history once a thread exceeds 60k tokens
- `HumanInTheLoopMiddleware` — requires approve/reject on every `bash` call
- `TodoListMiddleware` — gives the model a `write_todos` tool. Its raw
  `tool_start`/`tool_end` are suppressed (see `HIDDEN_TOOLS` in
  `chat_service.py`) in favor of a dedicated `todo_update` SSE event (the
  tool's input *is* the full new list each call, so it's emitted as-is —
  see `TODO_TOOL` handling in `ToolStartEventHandler`), rendered as a live
  checklist by `frontend/src/components/chat/todo-list.tsx`. The `research`
  subagent (below) has its own separate `TodoListMiddleware` instance per
  spawn — its `todo_update` events carry `task_run_id`, which the frontend
  uses to keep each subagent's checklist nested under its own badge instead
  of clobbering a single shared one when several subagents run in parallel.
- `ToolCallLimitMiddleware` (×3) — caps `web_search`/`web_fetch` at 50
  calls/run each, and `task` (subagent spawns) at 5/run — the `task` one uses
  `exit_behavior="continue"` rather than `"end"` like the others, since a
  burst that also calls other tools alongside the blocked `task` calls would
  otherwise raise `NotImplementedError`
- `SubAgentMiddleware` — exposes a `task` tool that delegates to the
  `research` subagent ([backend/app/agents/subagents.py](backend/app/agents/subagents.py)),
  which has its own `bash` (gated by its own `HumanInTheLoopMiddleware`, added
  automatically from `interrupt_on` on the `SubAgent` spec), its own
  `TodoListMiddleware`, and its own per-instance `ToolCallLimitMiddleware`s —
  all independent of, and in addition to, the main agent's `task` limiter
  above

The model is `ThinkingChatOpenAI` ([backend/app/agents/llm.py](backend/app/agents/llm.py)), a `ChatOpenAI`
subclass that reads `thinking_effort` and `model` out of LangGraph's
`configurable` at request time (via `langgraph.config.get_config()`) — this is
how per-turn reasoning depth and model overrides reach the LLM call without
rebuilding the graph. It also rescues OpenRouter's `reasoning` delta field
(which LangChain otherwise drops) into `additional_kwargs["reasoning"]`.

### Subagent tracing
A `task` call's nested tool calls (its own `web_search`/`web_fetch`, etc.) are
tracked by mapping every event's `run_id`/`parent_ids` back to the root
`task` invocation (`subagent_task_root` in `_run_graph`), so the frontend can
nest them under one "delegating to subagent" badge. The subagent's raw
token/thinking stream is *not* forwarded (it would interleave into garbled
text when multiple subagents run concurrently) — only its tool calls and
usage are. The full nested trace is persisted to Postgres
(`repository.save_subagent_trace`, keyed by the `task` call's
`tool_call_id`) purely so it survives a page reload; it is never read back
into the model's own context.

### Human-in-the-loop (bash approval)
`bash` calls interrupt the graph via `HumanInTheLoopMiddleware`. `_run_graph`
checks `graph.aget_state(config).interrupts` after the stream ends and emits
a `hitl_request` SSE event. The frontend resolves it via
`POST /api/v1/chat/resume`, which sends `Command(resume={"decisions": [...]})`
back into the same thread.

This also works when the interrupt originates *inside* a subagent (e.g. the
`research` subagent's own gated `bash` — see above): the interrupt raised
inside the `task` tool's nested `subagent.invoke()` still propagates all the
way to the main graph's `state.interrupts` in the same
`{"action_requests": ..., "review_configs": ...}` shape, verified live —
no special-casing needed in `chat_service.py` for nested vs. top-level.

One non-obvious LangGraph behavior this surfaces: resuming an interrupt
**re-executes that tool node from scratch** with a brand-new `run_id` (not a
continuation of the original call) — verified via a live `astream_events`
trace. `use-chat.ts`'s `resumeMessage` accounts for this by resolving any
still-`running`/`streaming` tool badges to `done` before the resume stream
starts, since their original `run_id` will never get a matching `tool_end`.

### Sandbox execution
The `bash` tool ([backend/app/agents/tools/bash.py](backend/app/agents/tools/bash.py)) runs inside a
per-thread Docker container (image built by `make build-sandbox`,
`Dockerfile.sandbox`), managed by `sandbox_manager.py`. Containers are
reaped by a TTL sweep (`_sandbox_cleanup_loop` in `main.py`, 30 min TTL,
checked every 5 min).

### Visualization tool
`generate_visualization_svg` renders its SVG output in a headless Chromium
page before returning ([backend/app/agents/tools/viz_validate.py](backend/app/agents/tools/viz_validate.py)) — same
sanitization/iframe-sandbox flags as the frontend renderer — so a broken SVG
comes back as `Error: ...` for the agent to see and retry, rather than
silently reaching the user broken.

### Database
Postgres holds two independent things:
- App data (conversations, etc.) — SQLAlchemy models in
  `backend/app/db/models.py`, managed by Alembic (`make migration` /
  `make migrate`).
- LangGraph's own checkpoint tables — created by `checkpointer.setup()`
  ([backend/app/db/connection.py](backend/app/db/connection.py)) at startup, **excluded from Alembic
  autogenerate**. Don't hand-edit or migrate these.

### File storage
Files the agent generates are pushed to MinIO (`backend/app/storage/minio_client.py`)
and surfaced to the user via the `represent_file` tool as downloadable chips;
the frontend's `file-tray.tsx` renders type-specific previews (image/SVG/PDF
inline, DOCX via `mammoth`, XLSX/CSV via SheetJS).

### Frontend state
`use-chat.ts` is the single hook owning conversation state, SSE parsing, and
HITL/interrupt/retry state per `thread_id`; it talks to the backend with
plain `fetch()` (no `EventSource`, no `AbortController`). Conversations route
via `?c=<id>` in the URL so a reload resumes the same thread.
