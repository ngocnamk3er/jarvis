"use client"

import { useState, useCallback, useEffect } from "react"
import { Message, MessagePart, StreamEvent, ThinkingEffort, ToolCall, Model, PendingHitl } from "@/types/chat"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

// ── Module-level per-thread storage (persists across conversation switches) ──
const _msgs = new Map<string, Message[]>()
const _loading = new Map<string, boolean>()
const _hitl = new Map<string, PendingHitl | null>()
const _interrupted = new Map<string, boolean>()

// Per-thread re-render subscribers
const _subs = new Map<string, Set<() => void>>()

// Global loading-change subscribers (for sidebar indicator)
const _loadingSubs = new Set<() => void>()

function _notify(tid: string) {
  _subs.get(tid)?.forEach(fn => fn())
}

function _setLoading(tid: string, val: boolean) {
  _loading.set(tid, val)
  _loadingSubs.forEach(fn => fn())
  _notify(tid)
}

export function subscribeLoadingChange(fn: () => void): () => void {
  _loadingSubs.add(fn)
  return () => _loadingSubs.delete(fn)
}

export function getLoadingSet(): ReadonlySet<string> {
  const s = new Set<string>()
  _loading.forEach((v, k) => { if (v) s.add(k) })
  return s
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function makeId() {
  return Math.random().toString(36).slice(2)
}

function parseSSELine(line: string): StreamEvent | null {
  if (!line.startsWith("data: ")) return null
  try { return JSON.parse(line.slice(6)) as StreamEvent } catch { return null }
}

function findStreamingToolByIndex(parts: MessagePart[], chunkIndex: number): number {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    if (p.type === "tool" && p.tool.status === "streaming" && p.tool.chunkIndex === chunkIndex) return i
  }
  return -1
}

// ── Standalone stream processor ───────────────────────────────────────────────
// Captured threadId ensures updates go to the right thread even if user switched away.
async function runStream(body: ReadableStream<Uint8Array>, threadId: string, targetMsgId: string) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let batchId = 0
  let prevEventType = ""

  function updateMsg(updater: (m: Message) => Message) {
    _msgs.set(threadId, (_msgs.get(threadId) ?? []).map(m => m.id === targetMsgId ? updater(m) : m))
    _notify(threadId)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const event = parseSSELine(line.trim())
      if (!event) continue

      switch (event.type) {
        case "thinking_token":
          updateMsg((m) => {
            const parts = [...m.parts]
            const last = parts[parts.length - 1]
            if (last?.type === "thinking") {
              parts[parts.length - 1] = { type: "thinking", content: last.content + event.content, isStreaming: true }
            } else {
              parts.push({ type: "thinking", content: event.content, isStreaming: true })
            }
            return { ...m, parts }
          })
          break

        case "token":
          updateMsg((m) => {
            const parts = [...m.parts]
            const last = parts[parts.length - 1]
            if (last?.type === "thinking" && last.isStreaming) {
              parts[parts.length - 1] = { ...last, isStreaming: false }
            }
            const updated = parts[parts.length - 1]
            if (updated?.type === "text") {
              parts[parts.length - 1] = { type: "text", content: updated.content + event.content }
            } else {
              parts.push({ type: "text", content: event.content })
            }
            return { ...m, parts }
          })
          break

        case "tool_chunk": {
          updateMsg((m) => {
            const parts = [...m.parts]
            const existing = findStreamingToolByIndex(parts, event.index)
            if (existing !== -1) {
              const p = parts[existing] as { type: "tool"; tool: ToolCall }
              parts[existing] = { ...p, tool: { ...p.tool, ...(event.name ? { name: event.name } : {}), argsStr: (p.tool.argsStr ?? "") + event.args_delta } }
            } else if (event.name) {
              parts.push({ type: "tool", tool: { name: event.name, chunkIndex: event.index, argsStr: event.args_delta, status: "streaming" } })
            }
            return { ...m, parts }
          })
          break
        }

        case "tool_start": {
          if (prevEventType !== "tool_start") batchId++
          const currentBatchId = String(batchId)
          updateMsg((m) => {
            const streamingIdx = m.parts.findIndex(
              (p) => p.type === "tool" && p.tool.name === event.name && p.tool.status === "streaming" &&
                     (!p.tool.run_id || p.tool.run_id === event.run_id)
            )
            if (streamingIdx !== -1) {
              return {
                ...m,
                parts: m.parts.map((p, i) => i === streamingIdx
                  ? { ...p, tool: { ...(p as { type: "tool"; tool: ToolCall }).tool, label: event.label, input: event.input, status: "running" as const, run_id: event.run_id, parent_run_id: currentBatchId } }
                  : p),
              }
            }
            return { ...m, parts: [...m.parts, { type: "tool" as const, tool: { name: event.name, label: event.label, input: event.input, status: "running" as const, run_id: event.run_id, parent_run_id: currentBatchId } }] }
          })
          break
        }

        case "tool_end":
          updateMsg((m) => {
            let matched = false
            const parts = m.parts.map((p) => {
              if (matched || p.type !== "tool") return p
              const tool = p.tool
              const byId = event.run_id && tool.run_id === event.run_id
              const byName = !event.run_id && tool.name === event.name && (tool.status === "running" || tool.status === "streaming")
              if (byId || byName) {
                matched = true
                let label = tool.label
                if (!label && tool.argsStr) { try { label = JSON.parse(tool.argsStr).label } catch { /**/ } }
                return { ...p, tool: { ...tool, label, output: event.output, status: "done" as const } }
              }
              return p
            })
            return { ...m, parts }
          })
          break

        case "viz":
          updateMsg((m) => ({ ...m, parts: [...m.parts, { type: "viz" as const, format: event.format, code: event.code, title: event.title }] }))
          break

        case "hitl_request":
          _hitl.set(threadId, { actions: event.actions, review_configs: event.review_configs })
          _notify(threadId)
          break

        case "done":
          updateMsg((m) => ({ ...m, isStreaming: false, parts: m.parts.map(p => p.type === "thinking" ? { ...p, isStreaming: false } : p) }))
          break

        case "error":
          updateMsg((m) => ({ ...m, parts: [{ type: "text", content: `Error: ${event.message}` }], isStreaming: false }))
          break
      }
      prevEventType = event.type
    }
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useChat(threadId: string | null) {
  const [, rerender] = useState(0)

  // Subscribe to updates for this thread
  useEffect(() => {
    if (!threadId) return
    if (!_subs.has(threadId)) _subs.set(threadId, new Set())
    const fn = () => rerender(n => n + 1)
    _subs.get(threadId)!.add(fn)
    return () => { _subs.get(threadId)?.delete(fn) }
  }, [threadId])

  const messages = threadId ? (_msgs.get(threadId) ?? []) : []
  const isLoading = threadId ? (_loading.get(threadId) ?? false) : false
  const pendingHitl = threadId ? (_hitl.get(threadId) ?? null) : null
  const interrupted = threadId ? (_interrupted.get(threadId) ?? false) : false

  const loadHistory = useCallback(async (id: string): Promise<boolean> => {
    const res = await fetch(`${API_URL}/api/v1/conversations/${id}/messages`)
    const data: { messages: { role: string; parts: MessagePart[] }[]; is_pending: boolean } = await res.json()
    const loaded: Message[] = data.messages.map((m) => ({
      id: makeId(),
      role: m.role as "user" | "assistant" | "system",
      parts: m.parts,
      isStreaming: false,
    }))
    _msgs.set(id, loaded)
    _interrupted.set(id, data.is_pending ?? false)
    _notify(id)
    return data.is_pending ?? false
  }, [])

  const clearThread = useCallback(() => {
    if (!threadId) return
    _msgs.set(threadId, [])
    _hitl.set(threadId, null)
    _interrupted.set(threadId, false)
    _notify(threadId)
  }, [threadId])

  const _doStream = useCallback(async (body: ReadableStream<Uint8Array>, tid: string, targetId: string) => {
    _setLoading(tid, true)
    try {
      await runStream(body, tid, targetId)
    } catch {
      _msgs.set(tid, (_msgs.get(tid) ?? []).map(m =>
        m.id === targetId ? { ...m, parts: [{ type: "text" as const, content: "Failed to connect to server." }], isStreaming: false } : m
      ))
      _notify(tid)
    } finally {
      _setLoading(tid, false)
    }
  }, [])

  const sendMessage = useCallback(
    async (content: string, thinking_effort: ThinkingEffort = "high", model?: Model) => {
      if (!threadId) return
      _hitl.set(threadId, null)
      _interrupted.set(threadId, false)

      const userMsg: Message = { id: makeId(), role: "user", parts: [{ type: "text", content }], isStreaming: false }
      const assistantId = makeId()
      const assistantMsg: Message = { id: assistantId, role: "assistant", parts: [], isStreaming: true }
      _msgs.set(threadId, [...(_msgs.get(threadId) ?? []), userMsg, assistantMsg])
      _notify(threadId)

      const res = await fetch(`${API_URL}/api/v1/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, content, thinking_effort, model: model?.id }),
      }).catch(() => null)

      if (!res?.body) {
        _msgs.set(threadId, (_msgs.get(threadId) ?? []).map(m =>
          m.id === assistantId ? { ...m, parts: [{ type: "text" as const, content: "Failed to connect to server." }], isStreaming: false } : m
        ))
        _notify(threadId)
        return
      }
      await _doStream(res.body, threadId, assistantId)
    },
    [threadId, _doStream]
  )

  const resumeMessage = useCallback(
    async (decision: "approve" | "reject") => {
      if (!threadId) return
      const msgs = _msgs.get(threadId) ?? []
      let resumeId = ""
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") { resumeId = msgs[i].id; break }
      }
      if (!resumeId) return

      _hitl.set(threadId, null)
      _msgs.set(threadId, msgs.map(m => m.id === resumeId ? { ...m, isStreaming: true } : m))
      _notify(threadId)

      const res = await fetch(`${API_URL}/api/v1/chat/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, decision }),
      }).catch(() => null)

      if (!res?.body) {
        _msgs.set(threadId, (_msgs.get(threadId) ?? []).map(m =>
          m.id === resumeId ? { ...m, parts: [...m.parts, { type: "text" as const, content: "Failed to resume." }], isStreaming: false } : m
        ))
        _notify(threadId)
        return
      }
      await _doStream(res.body, threadId, resumeId)
    },
    [threadId, _doStream]
  )

  return { messages, isLoading, pendingHitl, interrupted, sendMessage, resumeMessage, clearThread, loadHistory }
}

// ── Sidebar loading hook ───────────────────────────────────────────────────────
export function useLoadingThreadIds(): ReadonlySet<string> {
  const [, rerender] = useState(0)
  useEffect(() => {
    const fn = () => rerender(n => n + 1)
    _loadingSubs.add(fn)
    return () => { _loadingSubs.delete(fn) }
  }, [])
  return getLoadingSet()
}
