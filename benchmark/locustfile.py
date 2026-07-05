"""
Locust load test for Jarvis — covers all tools.

Run with LLM cache for deterministic results:
    LLM_CACHE=true uvicorn app.main:app  (backend)
    locust -f locustfile.py --host http://localhost:8000

Dashboard: http://localhost:8089
"""

import json
import time
import uuid
import requests
from locust import HttpUser, task, between


def _consume_sse_raw(url: str, payload: dict, host: str) -> tuple[list[dict], int, float]:
    """Stream SSE via raw requests, return (events, status_code, elapsed_ms)."""
    t0 = time.perf_counter()
    parsed_events = []
    try:
        with requests.post(
            host + url,
            json=payload,
            stream=True,
            timeout=120,
        ) as resp:
            status = resp.status_code
            for line in resp.iter_lines():
                if line:
                    line = line.decode("utf-8") if isinstance(line, bytes) else line
                    if line.startswith("data: "):
                        try:
                            parsed_events.append(json.loads(line[6:]))
                        except json.JSONDecodeError:
                            pass
    except Exception:
        return [], 0, (time.perf_counter() - t0) * 1000
    elapsed_ms = (time.perf_counter() - t0) * 1000
    return parsed_events, status, elapsed_ms


def _stream_and_resume(user: "JarvisUser", thread_id: str, content: str):
    """Send a chat message; if HITL interrupts, auto-approve and consume resumed stream."""
    payload = {"thread_id": thread_id, "content": content, "thinking_effort": "low"}
    parsed_events, status, elapsed_ms = _consume_sse_raw("/api/v1/chat/stream", payload, user.host)

    has_hitl = any(e.get("type") == "hitl_request" for e in parsed_events)
    has_error = any(e.get("type") == "error" for e in parsed_events)
    err_msg = None
    if has_error:
        err = next(e for e in parsed_events if e.get("type") == "error")
        err_msg = err.get("message", "unknown error")

    user.environment.events.request.fire(
        request_type="SSE",
        name="/api/v1/chat/stream",
        response_time=elapsed_ms,
        response_length=0,
        exception=Exception(err_msg) if err_msg else None,
        context={},
    )

    if err_msg or status not in (200, 207):
        return

    # Auto-approve bash HITL then consume resumed stream
    if has_hitl:
        _, status2, elapsed2 = _consume_sse_raw(
            "/api/v1/chat/resume",
            {"thread_id": thread_id, "decision": "approve"},
            user.host,
        )
        user.environment.events.request.fire(
            request_type="SSE",
            name="/api/v1/chat/resume",
            response_time=elapsed2,
            response_length=0,
            exception=None if status2 == 200 else Exception(f"HTTP {status2}"),
            context={},
        )


class JarvisUser(HttpUser):
    wait_time = between(1, 3)

    # ── No-tool tasks ──────────────────────────────────────────────────────────

    @task(4)
    def task_simple_qa(self):
        """Pure LLM answer — no tool call."""
        _stream_and_resume(
            self,
            str(uuid.uuid4()),
            "Giải thích ngắn gọn machine learning là gì?",
        )

    # ── get_current_time ──────────────────────────────────────────────────────

    @task(2)
    def task_get_time(self):
        """Triggers get_current_time tool."""
        _stream_and_resume(
            self,
            str(uuid.uuid4()),
            "Bây giờ là mấy giờ?",
        )

    # ── bash ──────────────────────────────────────────────────────────────────

    @task(3)
    def task_bash_simple(self):
        """Triggers bash tool (HITL auto-approved)."""
        _stream_and_resume(
            self,
            str(uuid.uuid4()),
            "Chạy lệnh echo 'hello world' cho tôi.",
        )

    @task(1)
    def task_bash_python(self):
        """Triggers bash + python execution."""
        _stream_and_resume(
            self,
            str(uuid.uuid4()),
            "Viết và chạy script Python tính tổng 1 đến 100.",
        )

    # ── web_search ────────────────────────────────────────────────────────────

    @task(2)
    def task_web_search(self):
        """Triggers web_search tool."""
        _stream_and_resume(
            self,
            str(uuid.uuid4()),
            "Tìm kiếm: Python 3.13 có tính năng mới gì?",
        )

    # ── web_fetch ─────────────────────────────────────────────────────────────

    @task(1)
    def task_web_fetch(self):
        """Triggers web_fetch tool."""
        _stream_and_resume(
            self,
            str(uuid.uuid4()),
            "Đọc và tóm tắt nội dung trang https://example.com",
        )

    # ── read_skill ────────────────────────────────────────────────────────────

    @task(2)
    def task_read_skill(self):
        """Triggers read_skill tool (python-dev skill)."""
        _stream_and_resume(
            self,
            str(uuid.uuid4()),
            "Cài pandas và đọc file CSV mẫu trong workspace.",
        )

    # ── represent_file ────────────────────────────────────────────────────────

    @task(1)
    def task_represent_file(self):
        """Triggers bash + represent_file."""
        _stream_and_resume(
            self,
            str(uuid.uuid4()),
            "Tạo file /workspace/hello.txt với nội dung 'xin chào' rồi xuất cho tôi tải về.",
        )

    # ── visualization tools ───────────────────────────────────────────────────

    @task(2)
    def task_mermaid(self):
        """Triggers generate_visualization_mermaid."""
        _stream_and_resume(
            self,
            str(uuid.uuid4()),
            "Vẽ flowchart mô tả quy trình: nhận đơn hàng → xử lý → giao hàng → hoàn thành.",
        )

    @task(1)
    def task_svg(self):
        """Triggers generate_visualization_svg."""
        _stream_and_resume(
            self,
            str(uuid.uuid4()),
            "Vẽ biểu đồ tròn SVG thể hiện tỉ lệ: Python 40%, JavaScript 35%, Java 25%.",
        )

    @task(1)
    def task_webapp(self):
        """Triggers generate_webapp."""
        _stream_and_resume(
            self,
            str(uuid.uuid4()),
            "Tạo một ứng dụng web đơn giản: calculator cộng trừ nhân chia.",
        )
