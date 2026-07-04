"""
Locust load test for Jarvis chat API.

Run:
    locust -f locustfile.py --host http://localhost:8000

Then open http://localhost:8089 to start the test.
"""

import uuid
from locust import HttpUser, task, between


class ChatUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        self.thread_id = str(uuid.uuid4())

    @task(3)
    def chat_simple(self):
        """Simple message — no tool calls, fast response."""
        with self.client.post(
            "/api/v1/chat/stream",
            json={
                "thread_id": self.thread_id,
                "content": "2 + 2 bằng bao nhiêu?",
                "thinking_effort": "low",
            },
            stream=True,
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"HTTP {resp.status_code}")
                return
            for _ in resp.iter_lines():
                pass
            resp.success()

    @task(1)
    def chat_with_tool(self):
        """Message requiring bash tool — heavier workload."""
        with self.client.post(
            "/api/v1/chat/stream",
            json={
                "thread_id": str(uuid.uuid4()),
                "content": "chạy lệnh echo hello world",
                "thinking_effort": "low",
            },
            stream=True,
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"HTTP {resp.status_code}")
                return
            for _ in resp.iter_lines():
                pass
            resp.success()
