"use client"

import { useEffect, useRef, useCallback } from "react"
import { Message } from "@/types/chat"
import { MessageItem } from "./message-item"
import { GeneratedFile } from "./file-tray"

const NEAR_BOTTOM_THRESHOLD = 120

export function MessageList({
  messages,
  previewFile,
  onPreviewFile,
}: {
  messages: Message[]
  previewFile: GeneratedFile | null
  onPreviewFile: (f: GeneratedFile | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)
  const isStreaming = messages.some((m) => m.isStreaming)

  const isNearBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD
  }, [])

  // When streaming ends, re-enable auto-scroll
  const prevStreaming = useRef(false)
  useEffect(() => {
    if (prevStreaming.current && !isStreaming) {
      userScrolledUp.current = false
    }
    prevStreaming.current = isStreaming
  }, [isStreaming])

  // Auto-scroll to bottom when messages update, unless user scrolled up
  useEffect(() => {
    if (!userScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const handleScroll = useCallback(() => {
    if (!isNearBottom()) {
      userScrolledUp.current = true
    } else {
      userScrolledUp.current = false
    }
  }, [isNearBottom])

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-8 py-6"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            previewFile={previewFile}
            onPreviewFile={onPreviewFile}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
