"use client"

import { useState, useCallback } from "react"
import { Message, MessagePart, StreamEvent, ThinkingEffort, ToolCall, Model, PendingHitl } from "@/types/chat"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

function makeId() {
  return Math.random().toString(36).slice(2)
}

function parseSSELine(line: string): StreamEvent | null {
  if (!line.startsWith("data: ")) return null
  try {
    return JSON.parse(line.slice(6)) as StreamEvent
  } catch {
    return null
  }
}

function findStreamingToolByIndex(parts: MessagePart[], chunkIndex: number): number {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    if (p.type === "tool" && p.tool.status === "streaming" && p.tool.chunkIndex === chunkIndex) return i
  }
  return -1
}

export function useChat(threadId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingHitl, setPendingHitl] = useState<PendingHitl | null>(null)

  const updateAssistant = useCallback(
    (id: string, updater: (msg: Message) => Message) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)))
    },
    []
  )

  const loadHistory = useCallback(async (id: string): Promise<boolean> => {
    const res = await fetch(`${API_URL}/api/v1/conversations/${id}/messages`)
    const data: { messages: { role: string; parts: MessagePart[] }[]; is_pending: boolean } = await res.json()
    const loaded: Message[] = data.messages.map((m) => ({
      id: makeId(),
      role: m.role as "user" | "assistant",
      parts: m.parts,
      isStreaming: false,
    }))
    setMessages(loaded)
    return data.is_pending ?? false
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setPendingHitl(null)
  }, [])

  // Shared SSE processing loop — updates the message with `targetId`
  const processStream = useCallback(
    async (body: ReadableStream<Uint8Array>, targetId: string) => {
      const reader = body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

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
              updateAssistant(targetId, (m) => {
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
              updateAssistant(targetId, (m) => {
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
              updateAssistant(targetId, (m) => {
                const parts = [...m.parts]
                const existing = findStreamingToolByIndex(parts, event.index)
                if (existing !== -1) {
                  const p = parts[existing] as { type: "tool"; tool: ToolCall }
                  parts[existing] = {
                    ...p,
                    tool: {
                      ...p.tool,
                      ...(event.name ? { name: event.name } : {}),
                      argsStr: (p.tool.argsStr ?? "") + event.args_delta,
                    },
                  }
                } else if (event.name) {
                  parts.push({
                    type: "tool",
                    tool: { name: event.name, chunkIndex: event.index, argsStr: event.args_delta, status: "streaming" },
                  })
                }
                return { ...m, parts }
              })
              break
            }

            case "tool_start":
              updateAssistant(targetId, (m) => {
                const streamingIdx = m.parts.findIndex(
                  (p) => p.type === "tool" && p.tool.name === event.name && p.tool.status === "streaming" &&
                         (!p.tool.run_id || p.tool.run_id === event.run_id)
                )
                if (streamingIdx !== -1) {
                  return {
                    ...m,
                    parts: m.parts.map((p, i) =>
                      i === streamingIdx
                        ? { ...p, tool: { ...(p as { type: "tool"; tool: ToolCall }).tool, label: event.label, input: event.input, status: "running" as const, run_id: event.run_id } }
                        : p
                    ),
                  }
                }
                return {
                  ...m,
                  parts: [...m.parts, { type: "tool" as const, tool: { name: event.name, label: event.label, input: event.input, status: "running" as const, run_id: event.run_id } }],
                }
              })
              break

            case "tool_end":
              updateAssistant(targetId, (m) => {
                let matched = false
                const parts = m.parts.map((p) => {
                  if (matched || p.type !== "tool") return p
                  const tool = p.tool
                  const byId = event.run_id && tool.run_id === event.run_id
                  const byName = !event.run_id && tool.name === event.name && (tool.status === "running" || tool.status === "streaming")
                  if (byId || byName) {
                    matched = true
                    // If tool_start never fired (e.g. blocked by limit middleware), recover label from argsStr
                    let label = tool.label
                    if (!label && tool.argsStr) {
                      try { label = JSON.parse(tool.argsStr).label } catch { /* ignore */ }
                    }
                    return { ...p, tool: { ...tool, label, output: event.output, status: "done" as const } }
                  }
                  return p
                })
                return { ...m, parts }
              })
              break

            case "viz":
              updateAssistant(targetId, (m) => ({
                ...m,
                parts: [...m.parts, { type: "viz" as const, format: event.format, code: event.code, title: event.title }],
              }))
              break

            case "hitl_request":
              setPendingHitl({ actions: event.actions, review_configs: event.review_configs })
              break

            case "done":
              updateAssistant(targetId, (m) => ({
                ...m,
                isStreaming: false,
                parts: m.parts.map((p) =>
                  p.type === "thinking" ? { ...p, isStreaming: false } : p
                ),
              }))
              break

            case "error":
              updateAssistant(targetId, (m) => ({
                ...m,
                parts: [{ type: "text", content: `Error: ${event.message}` }],
                isStreaming: false,
              }))
              break
          }
        }
      }
    },
    [updateAssistant]
  )

  const sendMessage = useCallback(
    async (content: string, thinking_effort: ThinkingEffort = "high", model?: Model) => {
      if (!threadId) return

      setPendingHitl(null)

      const userMessage: Message = {
        id: makeId(),
        role: "user",
        parts: [{ type: "text", content }],
        isStreaming: false,
      }

      const assistantId = makeId()
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        parts: [],
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      setIsLoading(true)

      try {
        const res = await fetch(`${API_URL}/api/v1/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thread_id: threadId, content, thinking_effort, model: model?.id }),
        })

        if (!res.body) throw new Error("No response body")
        await processStream(res.body, assistantId)
      } catch {
        updateAssistant(assistantId, (m) => ({
          ...m,
          parts: [{ type: "text", content: "Failed to connect to server." }],
          isStreaming: false,
        }))
      } finally {
        setIsLoading(false)
      }
    },
    [threadId, updateAssistant, processStream]
  )

  const resumeMessage = useCallback(
    async (decision: "approve" | "reject") => {
      if (!threadId) return

      // Read messages directly from closure — no state updater side-effects
      let resumeId = ""
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          resumeId = messages[i].id
          break
        }
      }
      if (!resumeId) return

      setPendingHitl(null)
      setMessages((prev) =>
        prev.map((m) => (m.id === resumeId ? { ...m, isStreaming: true } : m))
      )
      setIsLoading(true)

      try {
        const res = await fetch(`${API_URL}/api/v1/chat/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thread_id: threadId, decision }),
        })

        if (!res.body) throw new Error("No response body")
        await processStream(res.body, resumeId)
      } catch {
        updateAssistant(resumeId, (m) => ({
          ...m,
          parts: [...m.parts, { type: "text", content: "Failed to resume." }],
          isStreaming: false,
        }))
      } finally {
        setIsLoading(false)
      }
    },
    [threadId, messages, updateAssistant, processStream]
  )

  return { messages, isLoading, pendingHitl, sendMessage, resumeMessage, clearMessages, loadHistory }
}
