# Does the backend stop when the client disconnects mid-stream?

Date: 2026-07-18

## Question

When a user is chatting and reloads the browser (F5) mid-response, does the
LangGraph run driving that response actually stop on the backend, or does it
keep running to completion regardless?

## Relevant code path

- [backend/app/api/v1/endpoints/chat.py:22-25](../../backend/app/api/v1/endpoints/chat.py#L22-L25)
  — `POST /chat/stream` returns a `StreamingResponse` wrapping
  `chat_service.stream(...)` directly, no queue/background-task decoupling.
- [backend/app/services/chat_service.py:332](../../backend/app/services/chat_service.py#L332)
  — `_run_graph` drives the LLM/tool run with
  `async for event in graph.astream_events(...)`. This loop has no manual
  disconnect polling; it relies entirely on Starlette's built-in behavior:
  `StreamingResponse` races the generator against listening for an ASGI
  `http.disconnect` event, and cancels the generator's task if a disconnect
  arrives first.
- [frontend/src/hooks/use-chat.ts:276](../../frontend/src/hooks/use-chat.ts#L276)
  — the frontend issues a plain `fetch()` with no `AbortController`/`signal`
  and no `keepalive: true`. It relies entirely on the browser tearing down
  the in-flight request when the document unloads on reload.

**Conclusion up front: whether the backend actually stops depends entirely on
whether the client's disconnect signal reaches uvicorn as a real TCP
close/EOF.** The code path is identical in every scenario below — only the
network topology between browser and backend changes the outcome.

## Test setup

Built a minimal reproduction outside the real app (same `StreamingResponse`
+ bare async-generator shape as `chat_service.py`, ticking once/sec for 30
ticks, logging each tick with a timestamp) and drove it through three
different topologies, killing the client 3s after the request starts each
time:

- [`backend_test.py`](backend_test.py) — the same streaming shape as
  `_run_graph`, no manual disconnect checks.
- [`relay_tunnel.py`](relay_tunnel.py) — a raw-socket relay that models a
  VS Code port-forward / dev-tunnel: forwards client→upstream normally, but
  when the client side dies it does **not** close (or even notice closing)
  the upstream connection — it just silently drops what it can't deliver
  back to the dead client.
- Real **Kong Gateway** (`kong:3.7`, Docker, DB-less declarative config),
  as an actual reverse proxy in front of the same test backend.

## Results

| Scenario | Client killed at | Backend behavior | Outcome |
|---|---|---|---|
| **Direct connection** (curl → backend) | 3s in | `CANCELLED - generator torn down early` logged in the same second | ✅ Stops immediately |
| **VS Code port-forward / dev-tunnel** (curl → relay → backend) | 3s in | Kept ticking every second straight through `tick 29`, logged `COMPLETED all 30 ticks` 27s after the client died | ❌ Does **not** stop — runs to full completion |
| **Kong Gateway** (curl → Kong :8005 → backend) | 3s in | `CANCELLED - generator torn down early` logged in the same second | ✅ Stops immediately |

Raw log excerpts:

```
# Direct
13:19:04  killed curl (direct)
13:19:04  CANCELLED - generator torn down early

# VS Code tunnel-style relay
13:19:27  killed curl (through tunnel)
13:19:28..13:19:54  backend keeps ticking regardless (tick 3 .. tick 29)
13:19:54  COMPLETED all 30 ticks
# relay.log: "client gone, dropping bytes from upstream silently (tunnel keeps reading)"

# Kong Gateway
13:28:12  killed curl (through Kong)
13:28:12  CANCELLED - generator torn down early
```

## Why the difference

- **Direct / Kong**: both are a real reverse-proxy or direct socket model —
  one physical connection tracks one logical request. When the client
  disconnects, the proxy in front (Kong, built on nginx/OpenResty) closes
  its own connection to the upstream backend too
  (`proxy_ignore_client_abort` defaults to `off` in nginx — i.e. it does
  *not* ignore the client aborting, it reacts by closing upstream). Uvicorn
  sees the closed socket, Starlette fires `http.disconnect`, the generator
  in `chat_service.py` gets cancelled.
- **VS Code port-forward / dev-tunnel**: this is an application-level relay,
  not a 1:1 socket passthrough. It keeps its own connection to the backend
  alive independent of what happens to the browser's side, so uvicorn never
  observes a disconnect — `astream_events` just runs to completion, burning
  LLM tokens and writing to Postgres even though the user already reloaded
  and moved on.

## Practical implication

TCP-level disconnect detection (what `chat_service.py` currently relies on)
is **not reliable** when the client reaches the backend through a
VS Code port-forward / dev-tunnel (our own dev setup), but **is** reliable
through a real gateway like Kong or a direct connection.

## Recommended fix (not yet implemented)

Don't rely on ambient TCP disconnect detection. Add an explicit cancel
signal:
- Frontend: on `beforeunload`/`pagehide`, fire a small request (or
  `navigator.sendBeacon`) to a new `POST /chat/cancel` endpoint.
- Backend: keep a handle (task or cancel-flag) per `thread_id` for the
  in-flight `_run_graph` run; `/chat/cancel` cancels it directly, independent
  of whatever the underlying transport does with the socket.

This makes cancellation work the same way regardless of what's sitting
between the browser and the backend.

## Kong test artifact notes

Kong ran only as a disposable Docker container (`kong:3.7`, DB-less mode,
`--network host`), config at [`kong.yml`](kong.yml), pointed at the
throwaway test backend on port 9001 — never at the real Jarvis backend.
Container was removed after testing (`docker rm -f kong-test`); only the
pulled `kong:3.7` image remains cached locally.
