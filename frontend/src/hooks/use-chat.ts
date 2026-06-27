"use client"

import { useState, useCallback } from "react"
import { Message, MessagePart, StreamEvent, ToolCall } from "@/types/chat"

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

function findLastStreamingTool(parts: MessagePart[]): number {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    if (p.type === "tool" && p.tool.status === "streaming") return i
  }
  return -1
}

export function useChat(threadId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const updateAssistant = useCallback(
    (id: string, updater: (msg: Message) => Message) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)))
    },
    []
  )

  const loadHistory = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/api/v1/conversations/${id}/messages`)
    const data: { role: string; parts: MessagePart[] }[] = await res.json()
    const loaded: Message[] = data.map((m) => ({
      id: makeId(),
      role: m.role as "user" | "assistant",
      parts: m.parts,
      isStreaming: false,
    }))
    setMessages(loaded)
  }, [])

  const clearMessages = useCallback(() => setMessages([]), [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!threadId) return

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
          body: JSON.stringify({ thread_id: threadId, content }),
        })

        if (!res.body) throw new Error("No response body")

        const reader = res.body.getReader()
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
              case "token":
                updateAssistant(assistantId, (m) => {
                  const parts = [...m.parts]
                  const last = parts[parts.length - 1]
                  if (last?.type === "text") {
                    parts[parts.length - 1] = { type: "text", content: last.content + event.content }
                  } else {
                    parts.push({ type: "text", content: event.content })
                  }
                  return { ...m, parts }
                })
                break

              case "tool_chunk":
                updateAssistant(assistantId, (m) => {
                  const parts = [...m.parts]
                  if (event.name) {
                    parts.push({ type: "tool", tool: { name: event.name, argsStr: event.args_delta, status: "streaming" } })
                  } else {
                    const idx = findLastStreamingTool(parts)
                    if (idx !== -1) {
                      const p = parts[idx] as { type: "tool"; tool: ToolCall }
                      parts[idx] = { ...p, tool: { ...p.tool, argsStr: (p.tool.argsStr ?? "") + event.args_delta } }
                    }
                  }
                  return { ...m, parts }
                })
                break

              case "tool_start":
                updateAssistant(assistantId, (m) => {
                  const hasStreaming = m.parts.some(
                    (p) => p.type === "tool" && p.tool.name === event.name && p.tool.status === "streaming"
                  )
                  if (hasStreaming) {
                    return {
                      ...m,
                      parts: m.parts.map((p) =>
                        p.type === "tool" && p.tool.name === event.name && p.tool.status === "streaming"
                          ? { ...p, tool: { ...p.tool, input: event.input, status: "running" as const } }
                          : p
                      ),
                    }
                  }
                  return {
                    ...m,
                    parts: [...m.parts, { type: "tool" as const, tool: { name: event.name, input: event.input, status: "running" as const } }],
                  }
                })
                break

              case "tool_end":
                updateAssistant(assistantId, (m) => ({
                  ...m,
                  parts: m.parts.map((p) =>
                    p.type === "tool" && p.tool.name === event.name &&
                    (p.tool.status === "running" || p.tool.status === "streaming")
                      ? { ...p, tool: { ...p.tool, output: event.output, status: "done" as const } }
                      : p
                  ),
                }))
                break

              case "done":
                updateAssistant(assistantId, (m) => ({ ...m, isStreaming: false }))
                break

              case "error":
                updateAssistant(assistantId, (m) => ({
                  ...m,
                  parts: [{ type: "text", content: `Error: ${event.message}` }],
                  isStreaming: false,
                }))
                break
            }
          }
        }
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
    [threadId, updateAssistant]
  )

  return { messages, isLoading, sendMessage, clearMessages, loadHistory }
}
