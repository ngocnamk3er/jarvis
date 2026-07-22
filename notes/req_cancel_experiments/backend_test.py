import asyncio
import os
import time
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

LOG = os.path.join(os.path.dirname(__file__), "backend.log")


def log(msg: str):
    with open(LOG, "a") as f:
        f.write(f"{time.strftime('%H:%M:%S')} {msg}\n")


# Same shape as chat_service._run_graph: a plain async generator, no manual
# disconnect polling, handed straight to StreamingResponse - relies entirely
# on Starlette's built-in disconnect race.
async def run_graph_like():
    try:
        for i in range(30):
            await asyncio.sleep(1)
            log(f"tick {i}")
            yield f"data: {i}\n\n"
    except (asyncio.CancelledError, GeneratorExit):
        log("CANCELLED - generator torn down early")
        raise
    log("COMPLETED all 30 ticks")


@app.post("/stream")
async def stream():
    log("=== new request started ===")
    return StreamingResponse(run_graph_like(), media_type="text/event-stream")
