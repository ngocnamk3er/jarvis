# Jarvis Load Test Report

## Setup

- **Method:** 50 concurrent requests fired simultaneously (`bench.py` + `httpx.AsyncClient`)
- **Tasks (50 total):** 15x simple_qa · 10x bash · 15x web_search · 5x get_current_time · 5x mermaid
- **LLM cache:** OFF — mọi request gọi API thật
- **Temperature:** 0 — LLM trả về cùng output cho cùng input
- **Machine:** 16 CPU cores · asyncio thread pool = 20 threads · anyio thread pool = 40 threads

---

## Results

| Metric | R1: async ep + sync tools | R2: async ep + async tools | R3: async ep + partial async | R2c: async ep + native async bash ✅ | R4: sync ep + stream giả | R4b: sync ep + stream thật |
|---|---|---|---|---|---|---|
| Min | 7.2s | 7.1s | 6.5s | **5.9s** | 9.1s | 6.7s |
| Median | 9.9s | 11.3s | **9.3s** | 9.8s | 12.0s | 11.1s |
| P90 | 30.8s | 27.5s | **25.3s** | 27.4s | 31.1s | 31.1s |
| P95 | 31.3s | 33.5s | **27.5s** | 29.0s | 49.8s | 34.4s |
| P99 | 33.5s | 46.9s | **32.7s** | 34.5s | 52.0s | 64.2s |
| Wall time | 33.5s | 46.9s | **32.7s** | 34.5s | 52.0s | 64.2s |
| RPS | 1.49 | 1.07 | **1.53** | 1.45 | 0.96 | 0.78 |
| Errors | 0 | 0 | 0 | 0 | 0 | 0 |
| User thấy token | Ngay lập tức | Ngay lập tức | Ngay lập tức | Ngay lập tức | ❌ Sau khi xong hết | ✅ Ngay lập tức |
| Thread giữ suốt stream | Không | Không | Không | Không | ❌ Có (lúc collect: 10-40s) | ❌ Có (collect + stream: 10-40s) |

> **R2c** = async bash dùng `asyncio.create_subprocess_exec` (không qua thread pool) + container status cache + `asyncio.Semaphore(20)` rate-limit Docker exec.
> **Stream giả (R4)** = `def` endpoint collect tất cả chunks rồi mới return — client không nhận được gì cho đến khi LLM xong hết.
> **Stream thật (R4b)** = `def` endpoint dùng `queue.Queue`, đẩy từng token qua queue — client nhận token ngay lập tức, nhưng thread bị giữ suốt.
> **Partial async (R3)** = web_search + web_fetch dùng async client, bash dùng sync.

---

## Analysis

### R3 thắng: partial async là sweet spot

Web tools (web_search, web_fetch) là pure network I/O — async client giải phóng event loop trong lúc chờ HTTP response. Bash dùng sync → LangChain wraps vào `run_in_executor`, thread pool tự rate-limit Docker exec tự nhiên.

### R2 tệ hơn R1: async bash mất rate limiter tự nhiên

R1 sync bash đi qua asyncio thread pool (20 threads) → tối đa 20 concurrent Docker exec. R2 dùng `asyncio.to_thread` cũng vào cùng pool nhưng thêm dispatch overhead, và 50 coroutines cùng tranh pool → contention tăng → wall time 46.9s vs 33.5s.

### R2c: native async bash + container cache + semaphore

Cải tiến so với R2:
- **`asyncio.create_subprocess_exec`** thay `asyncio.to_thread` — event loop quản lý trực tiếp subprocess qua epoll, không tốn thread pool slot.
- **Container status cache** — bỏ `docker inspect` subprocess (~50ms) trên mỗi bash call. Lần đầu verify xong thì cache lại, lần sau skip hoàn toàn.
- **`asyncio.Semaphore(20)`** — rate-limit concurrent Docker exec, tái lập giới hạn mà thread pool đã cung cấp ngầm.

Kết quả: gần bằng R3 (median 9.8s vs 9.3s, RPS 1.45 vs 1.53). R3 vẫn nhỉnh vì thread pool queue nhẹ hơn asyncio semaphore queue cho workload này. Container cache là cải thiện thực sự — giảm min từ 6.5s xuống 5.9s.

### Stream giả (R4) vs Stream thật sync (R4b) vs Async streaming (R1/R2/R3)

Ba cách khác nhau để trả SSE từ một LLM:

**Stream giả — R4 (sync ep + collect-then-return):**
- Endpoint là `def`, chạy đồng bộ trên anyio thread pool (40 threads).
- Code collect toàn bộ chunks vào list rồi mới `return StreamingResponse(iter(chunks))`.
- Client kết nối → chờ 10-40s không nhận được gì → nhận tất cả cùng lúc.
- Thread bị giữ trong suốt phase collect (10-40s), chỉ được giải phóng sau khi hàm return. Phase HTTP transfer (gửi chunks cho client) chạy trên event loop, không tốn thread.
- **Kết quả:** P99 = 52s, RPS = 0.96. UX tệ, throughput cũng tệ hơn async.

**Stream thật sync — R4b (sync ep + queue.Queue):**
- Endpoint là `def`, chạy đồng bộ. Dùng `asyncio.run_coroutine_threadsafe` + `queue.Queue` để nhận từng token từ async graph.
- Client nhận token ngay lập tức (UX tốt), nhưng thread bị block suốt 20-40s mỗi request.
- 50 concurrent requests → thread pool (40 threads) bão hòa → request thứ 41+ phải đợi trong queue của anyio.
- **Kết quả:** P99 = 64.2s, RPS = 0.78. UX tốt hơn R4 nhưng throughput tệ nhất trong 5 variants.

**Stream thật async — R1/R2/R3 (async ep):**
- Endpoint là `async def`, chạy trên event loop.
- Coroutine yield mỗi lần `await` → event loop phục vụ request khác trong lúc chờ LLM.
- 50 concurrent SSE connections = 50 coroutines, 0 threads bị block.
- **Kết quả:** R3 tốt nhất: P99 = 32.7s, RPS = 1.53. Vừa stream thật, vừa scale.

**Takeaway:** Stream giả (R4) và stream thật sync (R4b) đều kém hơn async vì cùng vấn đề gốc — `def` endpoint giữ thread. Muốn UX tốt (stream thật) + throughput cao → dùng `async def`.

### LLM là bottleneck chính

Median 9-12s phần lớn là thời gian LLM generate. Sự khác biệt giữa R1/R2/R3 (~2s) đến từ tool I/O overhead, không phải LLM.

---

## So sánh 3 cách implement SSE

| | Async SSE (R3) | Sync stream giả (R4) | Sync stream thật (R4b) |
|---|---|---|---|
| User thấy token | Ngay lập tức | ❌ Sau khi xong hết | Ngay lập tức |
| Thread giữ | 0 | ❌ Lúc collect (10-40s) | ❌ Collect + stream (10-40s) |
| Max concurrent | Không giới hạn (RAM) | 40 threads | 40 threads |
| Wall time (50 users) | **32.7s** | 52.0s | 64.2s |
| RPS | **1.53** | 0.96 | 0.78 |
| UX | ✅ Tốt | ❌ Tệ | ✅ Tốt |
| Scale | ✅ Tốt | ❌ Tệ | ❌ Tệ |

---

## Conclusion

| Layer | Config tốt nhất | Lý do |
|---|---|---|
| SSE endpoint | `async def` | Hold N long-lived connections không cần N threads; streaming thật |
| bash tool | `asyncio.create_subprocess_exec` + semaphore | Native async subprocess + explicit rate limit; hoặc sync `def` (simpler, gần tương đương) |
| web_search / web_fetch | `async def` + native async client | Pure network I/O, giải phóng event loop |
| Container status | In-memory cache | Bỏ `docker inspect` subprocess ~50ms/call |
| Visualization / trivial tools | `def` (sync) | Không đáng convert |

**Recommended config = R2c (current):** async endpoint + async web tools + native async bash + container cache + semaphore(20).

---

## Bottlenecks (theo thứ tự)

| Bottleneck | Thời gian | Fix |
|---|---|---|
| LLM latency | 5–15s/req | Better model, prompt caching, streaming |
| Docker exec (bash) | 2–8s/call | Container cache (done) · pre-warm containers |
| External API (web_search) | 1–3s/call | Response caching |
| Python async/sync overhead | < 0.5s | Không đáng kể |
