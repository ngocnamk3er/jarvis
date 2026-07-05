# Load Test Results — Sync vs Async (Tools + SSE Endpoint)

## Test config
- Method: 50 concurrent requests fired simultaneously (bench.py, httpx.AsyncClient)
- Host: http://localhost:8000
- Machine: 16 CPU cores

---

## Round 1 vs Round 2 — Sync tools vs Async tools (50 concurrent, async endpoint)

| Metric | R1: Sync tools | R2: Async tools |
|---|---|---|
| Min | 4.1s | 3.8s |
| Median | **8.4s** | 10.6s |
| P75 | 18.5s | 18.8s |
| P90 | 26.1s | 29.0s |
| P95 | 26.9s | 32.5s |
| P99 | 39.4s | 39.2s |
| Wall time | 39.4s | 39.2s |
| RPS | 1.27 | 1.27 |

**Kết luận: gần như bằng nhau.** LLM latency (3-30s/req) là bottleneck duy nhất — async/sync tools không ảnh hưởng đến wall time. Cả 50 request đều chờ LLM, không phải chờ thread pool.

---

## Round 3 — Async endpoint + partial async (locustfile cũ, đo sai SSE)

⚠️ Đo bằng locustfile cũ — không so sánh được với R1/R2.

| Aggregated | Requests | Median | P95 | RPS |
|---|---|---|---|---|
| Partial async | 73 | 52s | 72s | 0.87 |

---

## Round 4 — Sync endpoint + sync tools (locustfile cũ, đo sai SSE)

⚠️ Đo bằng locustfile cũ — không so sánh được với R1/R2.

| Aggregated | Requests | Median | P95 | RPS |
|---|---|---|---|---|
| Sync endpoint | 76 | 43s | 67s | 0.92 |

---

## Key findings

### 1. Sync tools ≈ Async tools về performance
- Tại 50 users: LLM latency che hết sự khác biệt giữa thread pool vs event loop
- Thread pool chưa bao giờ saturate vì hầu hết thời gian chờ LLM, không phải chờ tool
- Async tools có lợi thế **kiến trúc**: không cạnh tranh thread pool với CPU-bound tasks

### 2. Async endpoint đúng cho SSE
- SSE là long-lived connection (10-40s) → async giữ N connections không cần N threads
- Sync collect-then-return: user không thấy gì cho đến khi response hoàn thành

### 3. LLM là bottleneck thực sự
- Wall time = thời gian request chậm nhất, không giảm được bằng async/sync
- Fix thực: better model, LLM cache, hoặc giảm số tool calls

---

## Recommended config (current)
- Endpoint: `async def` ✅ — UX streaming + scalability
- bash: `async def` + `asyncio.to_thread` ✅ — không block event loop
- web_fetch: `async def` + `httpx.AsyncClient` ✅
- web_search: `async def` + `AsyncTavilyClient` ✅
- represent_file, read_skill, visualization tools: `sync` (trivial, không đáng convert)

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
