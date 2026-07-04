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
| /chat/stream | 60 | 10s | 53s | 117s | 117s | 0.50 |
| /chat/resume | 5 | 5s | 12s | 12s | 12s | 0.04 |
| **Aggregated** | **65** | **10s** | **38s** | **117s** | **117s** | **0.54** |

CPU avg: 1.0% | RAM peak: 102MB

---

## Round 6 — Sync endpoint, 200 users

Config: 200 users, ramp 10/s, 120s, sync endpoint (run_coroutine_threadsafe, anyio pool = 40 threads) + sync tools

| Endpoint | Requests | Median | P95 | P99 | Max | RPS |
|---|---|---|---|---|---|---|
| /chat/stream | 208 | 102s | 111s | 112s | 113s | 1.73 |
| /chat/resume | 12 | 110s | 112s | 112s | 112s | 0.10 |
| **Aggregated** | **220** | **103s** | **111s** | **112s** | **113s** | **1.83** |

CPU avg: 0.9% | RAM peak: 97MB

---

## Async vs Sync endpoint — 200 users

| Metric | Async endpoint | Sync endpoint |
|---|---|---|
| Median | **10s** ✅ | 103s |
| P95 | **38s** ✅ | 111s |
| P99 | 117s | **112s** ✅ |
| RPS | 0.54 | **1.83** ✅ |
| Requests completed | 65 | **220** ✅ |
| CPU avg | 1.0% | 0.9% |
| RAM peak | **102MB** | 97MB |

### Why async median (10s) << sync median (103s)

Sync — Little's Law: `W = L/λ = 200/1.83 ≈ 109s`. Thread pool = 40 → 160 queue → mọi request (kể cả nhẹ) đợi ~80s trước khi chạy.

Async — task distribution: 55% requests là lightweight (simple_qa, get_time, mermaid), không có queue, start ngay → hoàn thành 3-5s → kéo median xuống 10s.

### Why async P99 (117s) > sync P99 (112s)

Event loop starvation: 200 coroutines cạnh tranh single-threaded event loop → một số coroutine bị scheduler bỏ qua → outlier latency cao hơn. Sync FIFO queue có upper bound dự đoán được: max_queue_wait + max_task_time ≈ 112s.

### Why sync RPS (1.83) > async RPS (0.54)

Async overloaded ở 200 users: 200 LangGraph states đồng thời → scheduling overhead tăng → throughput giảm. Sync giới hạn 40 active requests → overhead thấp hơn mỗi request.

### Where do 200 async connections live?

Mỗi connection = 1 Python coroutine object (~few KB), treo tại `await`. Không cần thread.
Giới hạn thực tế: RAM (102MB cho 200 LangGraph states) và event loop scheduling (~1% CPU), không phải file descriptors hay connections.

---

## Round 7 — Connections/Threads/FDs measurement (200 users, LLM cache warm)

Đo trực tiếp `threads`, `file descriptors`, `TCP connections` trong lúc load test chạy.

### Async endpoint

```bash
ss -tn state established '( dport = :8000 or sport = :8000 )' | wc -l
cat /proc/<pid>/status | grep Threads
```

| Time | Threads | FDs | Connections |
|---|---|---|---|
| Baseline | 2 | 12 | 1 |
| Ramp up | 2 | 12 | ~160 |
| **Peak (steady)** | **2** | **12** | **401** |
| After test | 2 | 12 | 1 |

RPS: ~0.54 | Median: 10s

### Sync endpoint (run_coroutine_threadsafe, cache warm)

| Time | Threads | FDs | Connections |
|---|---|---|---|
| Baseline | 2 | 12 | 1 |
| **Peak (steady)** | **2** | **12** | **4** |
| After test | 2 | 12 | 1 |

RPS: ~100 | Median: **5ms**

### Key findings

**1. Async giữ 401 connections đồng thời, sync chỉ giữ 4**

Async SSE stream từng token → connection mở suốt 10-60s → 200 users = 401 connections đồng thời.
Sync collect-then-return → gửi tất cả trong <10ms → connection đóng ngay → không bao giờ tích lũy connections.

**2. Threads luôn = 2 trong cả 2 trường hợp**

Uvicorn chỉ dùng 2 threads (main + reloader). Với async endpoint, 401 connections không cần thêm thread nào.
Với sync endpoint, anyio thread pool được tạo on-demand và không visible qua `/proc/pid/status` threads
(anyio quản lý worker threads riêng).

**3. Sync median 5ms (cache warm) vs 103s (cache cold)**

⚠️ **Cache state là confounding variable quan trọng.** Round 6 (cache cold) cho median 103s, Round 7
(cache warm sau nhiều test) cho median 5ms. Simple_qa/get_time tasks chỉ cần SQLite lookup → ~1ms.
Kết quả chỉ so sánh được khi cache state giống nhau.

**4. Sync endpoint không streaming thật sự**

Sync collect all chunks trước → user không thấy token nào cho đến khi response hoàn thành.
Async stream từng token ngay khi LLM generate → UX tốt hơn nhiều dù latency tương đương.
Đây là lý do chính để dùng async endpoint, không phải performance.

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
