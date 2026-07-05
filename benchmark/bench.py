"""
Send 50 concurrent SSE requests, measure full stream time (HITL auto-approved).
Usage:
    python bench.py "Round label"
"""
import asyncio
import json
import statistics
import sys
import time
import uuid

import httpx

HOST = "http://localhost:8000"
TIMEOUT = 90.0

TASKS = (
    ["Giải thích ngắn gọn machine learning là gì?"] * 15 +
    ["Chạy lệnh echo 'hello world' trong sandbox."] * 10 +
    ["Tìm kiếm: Python 3.13 có tính năng mới gì?"] * 15 +
    ["Bây giờ là mấy giờ?"] * 5 +
    ["Vẽ flowchart: nhận đơn → xử lý → giao hàng."] * 5
)  # 50 tasks total


async def _read_stream(client: httpx.AsyncClient, url: str, payload: dict) -> tuple[bool, str | None]:
    """Read SSE stream to completion. Returns (has_hitl, error)."""
    has_hitl = False
    try:
        async with client.stream("POST", HOST + url, json=payload, timeout=TIMEOUT) as resp:
            if resp.status_code != 200:
                return False, f"HTTP {resp.status_code}"
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                try:
                    ev = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue
                t = ev.get("type")
                if t == "done":
                    break
                if t == "error":
                    return False, ev.get("message", "unknown error")
                if t == "hitl_request":
                    has_hitl = True
    except Exception as e:
        return False, str(e)
    return has_hitl, None


async def run_one(client: httpx.AsyncClient, content: str) -> tuple[float, str | None]:
    thread_id = str(uuid.uuid4())
    t0 = time.perf_counter()

    has_hitl, err = await _read_stream(
        client, "/api/v1/chat/stream",
        {"thread_id": thread_id, "content": content, "thinking_effort": "low"},
    )
    if err:
        return (time.perf_counter() - t0) * 1000, err

    if has_hitl:
        _, err = await _read_stream(
            client, "/api/v1/chat/resume",
            {"thread_id": thread_id, "decision": "approve"},
        )

    elapsed = (time.perf_counter() - t0) * 1000
    return elapsed, err


async def run(label: str):
    limits = httpx.Limits(max_connections=100, max_keepalive_connections=50)
    async with httpx.AsyncClient(limits=limits) as client:
        coros = [run_one(client, t) for t in TASKS]
        t_wall = time.perf_counter()
        results = await asyncio.gather(*coros)
        wall = (time.perf_counter() - t_wall) * 1000

    times = sorted(ms for ms, err in results if err is None)
    errors = [err for _, err in results if err]
    n = len(times)

    print(f"\n{'='*55}")
    print(f"  {label}")
    print(f"{'='*55}")
    print(f"  Total:   {len(TASKS)}   OK: {n}   Errors: {len(errors)}")
    if times:
        print(f"  Min:     {times[0]/1000:.1f}s")
        print(f"  Median:  {statistics.median(times)/1000:.1f}s")
        print(f"  P90:     {times[int(n*.90)]/1000:.1f}s")
        print(f"  P95:     {times[int(n*.95)]/1000:.1f}s")
        print(f"  P99:     {times[min(int(n*.99), n-1)]/1000:.1f}s")
        print(f"  Max:     {times[-1]/1000:.1f}s")
        print(f"  Wall:    {wall/1000:.1f}s")
        print(f"  RPS:     {n/(wall/1000):.2f}")
    if errors:
        print(f"  Errors:  {errors[:3]}")


if __name__ == "__main__":
    label = sys.argv[1] if len(sys.argv) > 1 else "Benchmark"
    asyncio.run(run(label))
