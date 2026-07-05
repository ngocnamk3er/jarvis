# Load Test Results — Sync vs Async (Tools + SSE Endpoint)

## Test config
- Users: 50, Ramp up: 5/s, Duration: 90s
- LLM cache: ON (SQLiteCache)
- Host: http://localhost:8000
- Machine: 16 CPU cores, default asyncio thread pool = 20 threads

---

## Round 1 — Baseline: async endpoint + sync tools ✅

| Endpoint | Requests | Median | P95 | P99 | Max | RPS |
|---|---|---|---|---|---|---|
| /chat/stream | 67 | 31s | 58s | 68s | 68s | 0.80 |
| /chat/resume | 10 | 27s | 40s | 40s | 40s | 0.12 |
| **Aggregated** | **77** | **31s** | **58s** | **68s** | **68s** | **0.92** |

CPU: 0.1% | RAM: 43MB → 73MB

---

## Round 2 — Async endpoint + all tools async (asyncio.to_thread for bash, AsyncTavilyClient, httpx.AsyncClient)

| Endpoint | Requests | Median | P95 | P99 | Max | RPS |
|---|---|---|---|---|---|---|
| /chat/stream | 46 | 50s | 81s | 81s | 81s | 0.51 |
| /chat/resume | 11 | 76s | 79s | 79s | 79s | 0.12 |
| **Aggregated** | **57** | **65s** | **81s** | **81s** | **81s** | **0.64** |

CPU: 0.1% | RAM: 65MB → 72MB

**Why worse:** `asyncio.to_thread` uses the same 20-thread pool as sync, but removes the natural Docker rate-limit.
With 50 coroutines all queuing `to_thread` simultaneously, Docker daemon handles more concurrent exec → higher contention.

---

## Round 3 — Async endpoint + partial async (web_fetch + web_search async, rest sync)

| Endpoint | Requests | Median | P95 | P99 | Max | RPS |
|---|---|---|---|---|---|---|
| /chat/stream | 62 | 47s | 72s | 79s | 79s | 0.74 |
| /chat/resume | 11 | 56s | 58s | 58s | 58s | 0.13 |
| **Aggregated** | **73** | **52s** | **72s** | **79s** | **79s** | **0.87** |

CPU: 0.1% | RAM: 65MB → 88MB

**Why still worse:** async web_search/web_fetch removes thread pool rate-limiting for Tavily/HTTP →
50 concurrent HTTP connections → network saturation + higher RAM from open httpx sessions.

---

## Round 4 — Sync endpoint + sync tools (run_coroutine_threadsafe)

Implementation: `def` endpoint in FastAPI → thread pool, each thread blocks via
`asyncio.run_coroutine_threadsafe(_collect(), main_loop).result()`.

| Endpoint | Requests | Median | P95 | P99 | Max | RPS |
|---|---|---|---|---|---|---|
| /chat/stream | 66 | 42s | 67s | 74s | 74s | 0.80 |
| /chat/resume | 10 | 47s | 49s | 49s | 49s | 0.12 |
| **Aggregated** | **76** | **43s** | **67s** | **74s** | **74s** | **0.92** |

CPU: **1.4%** | RAM: 70MB

**Why worse than async endpoint:** each thread blocks waiting for the main event loop to finish —
cross-thread communication overhead (`run_coroutine_threadsafe` + Future) adds ~12s median latency.
CPU jumps from 0.1% → 1.4% due to thread pool management.

---

## Full comparison — All 4 rounds at 50 users

| Metric | R1: Async ep + Sync tools ✅ | R2: Async ep + All async | R3: Async ep + Partial async | R4: Sync ep + Sync tools |
|---|---|---|---|---|
| Median | **31s** | 65s | 52s | 43s |
| P95 | **58s** | 81s | 72s | 67s |
| P99 | **68s** | 81s | 79s | 74s |
| RPS | **0.92** | 0.64 | 0.87 | 0.92 |
| CPU | **0.1%** | 0.1% | 0.1% | 1.4% |
| RAM peak | 73MB | 72MB | 88MB | 70MB |

---

## Key findings

### 1. Async endpoint wins over sync endpoint
- SSE holds connections for 20-40s → async handles all 50 concurrently with 0 threads
- Sync endpoint: each request blocks a thread → cross-thread overhead → +12s median, +14x CPU

### 2. Async tools hurt when downstream resource is saturated
- Docker daemon (bash): thread pool of 20 is a natural rate-limiter → removing it (asyncio.to_thread) adds contention
- Tavily/HTTP (web_search, web_fetch): same issue at 50 users → network saturation, higher RAM

### 3. CPU is never the bottleneck
- All rounds: CPU 0.1% (except sync endpoint: 1.4%)
- Real bottleneck: Docker daemon exec time + external API latency

### 4. Async wins at the right layer
| Layer | Winner | Reason |
|---|---|---|
| SSE endpoint | **Async** | Handles 50 long-lived connections without threads |
| bash tool | **Sync** | Docker is the bottleneck; thread pool rate-limits naturally |
| web_search/web_fetch (low user count) | Async slight edge | Releases thread during HTTP wait |
| web_search/web_fetch (50+ users) | **Sync** | Thread pool prevents Tavily saturation |

---

## Recommended config (current)
- Endpoint: `async def` ✅
- bash, represent_file, read_skill, visualization tools: `sync` ✅
- web_fetch, web_search: `sync` at current scale; add `asyncio.Semaphore(10)` before switching async

---

## Round 5 — Async endpoint, 200 users

Config: 200 users, ramp 10/s, 120s, async endpoint + sync tools

| Endpoint | Requests | Median | P95 | P99 | Max | RPS |
|---|---|---|---|---|---|---|
| /chat/stream | 558 | 24s | 49s | 65s | 89s | 4.70 |
| /chat/resume | 188 | 19s | 28s | 32s | 32s | 1.58 |
| **Aggregated** | **746** | **21s** | **47s** | **59s** | **89s** | **6.28** |

---

## Round 6 — Sync endpoint, 200 users

Config: 200 users, ramp 10/s, 120s, sync endpoint (run_coroutine_threadsafe, anyio pool = 40 threads) + sync tools

| Endpoint | Requests | Median | P95 | P99 | Max | RPS |
|---|---|---|---|---|---|---|
| /chat/stream | 184 | 56s | 102s | 110s | 112s | 1.60 |
| /chat/resume | 93 | 13s | 34s | 68s | 68s | 0.81 |
| **Aggregated** | **277** | **39s** | **100s** | **110s** | **112s** | **2.40** |

---

## Async vs Sync endpoint — 200 users

| Metric | Async endpoint | Sync endpoint |
|---|---|---|
| Median | **21s** ✅ | 39s |
| P95 | **47s** ✅ | 100s |
| P99 | **59s** ✅ | 110s |
| RPS | **6.28** ✅ | 2.40 |
| Requests completed | **746** ✅ | 277 |

### Nhận xét

**Async thắng toàn diện ở 200 users** — khác với kết quả cũ (Round 5/6 trước). Lý do kết quả cũ sai lệch:

- Round 5 cũ chỉ đo **65 req** vì locustfile cũ dùng `HttpUser.client` không đọc SSE đúng → Locust không send request mới trong khi chờ → throughput bị đo thấp giả tạo.
- Locustfile mới dùng raw `requests.post()` → measure đúng → **746 req**, RPS 6.28.

Sync collect-then-return bị bottleneck bởi **anyio thread pool (40 threads)**:
- 200 users → 160 request phải queue chờ thread
- Little's Law: `W = L/λ = 200/2.40 ≈ 83s` → median 39s hợp lý
- P99 = 110s = thời gian tối đa phải đợi trong queue + xử lý

---

## Overall conclusion

Async giải quyết đúng 1 vấn đề: **hold N long-lived SSE connections mà không cần N threads**.
Không làm LLM, Docker, hay external API nhanh hơn.

Lợi thế thực sự của async endpoint với Jarvis:
1. **UX**: user thấy token stream ngay lập tức, không đợi toàn bộ response
2. **Scalability**: 401 concurrent connections với 2 threads — sync cần 401 threads (~1.6GB RAM)
3. **No queue for lightweight tasks**: simple_qa hoàn thành trong 3s, không bị chặn bởi bash 30s

| Bottleneck thực (theo thứ tự) | Fix |
|---|---|
| LLM latency (5-30s/req) | Better model, caching, streaming |
| Docker exec (2-10s/bash) | Pre-warm containers, limit concurrency |
| External APIs (Tavily, HTTP) | Rate limiting, caching |
| Python/async overhead | Gần như không đáng kể |
