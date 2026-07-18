"""Minimal raw-socket relay that models what a badly-decoupled port-forward /
dev-tunnel does: it forwards client bytes upstream, but when the client side
dies it does NOT close (or even notice closing) the upstream connection - it
just keeps reading from upstream and silently drops what it can't deliver.

This is the behavior difference between a plain TCP passthrough (which
propagates FIN/RST both ways) and an application-level tunnel relay (which
often doesn't), used to reproduce the VS Code port-forward / dev-tunnel
scenario locally.
"""
import asyncio
import os
import time

UPSTREAM_HOST = "127.0.0.1"
UPSTREAM_PORT = 9001
LISTEN_PORT = 9002

LOG = os.path.join(os.path.dirname(__file__), "relay.log")


def log(msg: str):
    with open(LOG, "a") as f:
        f.write(f"{time.strftime('%H:%M:%S')} {msg}\n")


async def handle_client(client_reader, client_writer):
    log("client connected to tunnel")
    upstream_reader, upstream_writer = await asyncio.open_connection(UPSTREAM_HOST, UPSTREAM_PORT)

    async def client_to_upstream():
        try:
            while True:
                data = await client_reader.read(4096)
                if not data:
                    log("client->tunnel EOF (client disconnected) - NOT closing upstream")
                    break
                upstream_writer.write(data)
                await upstream_writer.drain()
        except Exception as e:
            log(f"client->upstream error (ignored, upstream stays open): {e}")
        # Deliberately do NOT close upstream_writer here.

    async def upstream_to_client():
        try:
            while True:
                data = await upstream_reader.read(4096)
                if not data:
                    log("upstream EOF - closing tunnel side")
                    break
                try:
                    client_writer.write(data)
                    await client_writer.drain()
                except Exception:
                    log("client gone, dropping bytes from upstream silently (tunnel keeps reading)")
        except Exception as e:
            log(f"upstream->client error: {e}")

    await asyncio.gather(client_to_upstream(), upstream_to_client())
    try:
        client_writer.close()
    except Exception:
        pass
    upstream_writer.close()
    log("tunnel connection fully torn down (upstream closed only now)")


async def main():
    server = await asyncio.start_server(handle_client, "127.0.0.1", LISTEN_PORT)
    log(f"tunnel relay listening on {LISTEN_PORT} -> {UPSTREAM_HOST}:{UPSTREAM_PORT}")
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
