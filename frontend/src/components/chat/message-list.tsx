"use client"

import { useEffect, useRef } from "react"
import { Message } from "@/types/chat"
import { MessageItem } from "./message-item"
import { GeneratedFile } from "./file-tray"

export function MessageList({
  messages,
  previewFile,
  onPreviewFile,
}: {
  messages: Message[]
  previewFile: GeneratedFile | null
  onPreviewFile: (f: GeneratedFile | null) => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
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
