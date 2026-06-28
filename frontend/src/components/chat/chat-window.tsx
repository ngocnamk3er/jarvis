"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { useChat } from "@/hooks/use-chat"
import { useConversations } from "@/hooks/use-conversations"
import { Sidebar } from "./sidebar"
import { EmptyState } from "./empty-state"
import { MessageList } from "./message-list"
import { ChatInput } from "./chat-input"
import { PreviewPanel, GeneratedFile } from "./file-tray"

export function ChatWindow() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const { conversations, create, remove } = useConversations()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [interrupted, setInterrupted] = useState(false)
  const pendingContent = useRef<{ content: string; effort: import("@/types/chat").ThinkingEffort } | null>(null)

  const { messages, isLoading, sendMessage, clearMessages, loadHistory } = useChat(activeId)
  const [previewFile, setPreviewFile] = useState<GeneratedFile | null>(null)

  async function openConversation(id: string) {
    const isPending = await loadHistory(id)
    setInterrupted(isPending)
  }

  // Restore active conversation from URL on mount
  useEffect(() => {
    const cid = searchParams.get("c")
    if (cid) {
      setActiveId(cid)
      openConversation(cid)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Send pending message after activeId is set (new conversation flow)
  useEffect(() => {
    if (activeId && pendingContent.current) {
      sendMessage(pendingContent.current.content, pendingContent.current.effort)
      pendingContent.current = null
    }
  }, [activeId, sendMessage])

  function activate(id: string | null) {
    setActiveId(id)
    setInterrupted(false)
    router.replace(id ? `/?c=${id}` : "/")
  }

  const handleNewChat = () => {
    activate(null)
    clearMessages()
  }

  const handleSelectConversation = async (id: string) => {
    activate(id)
    await openConversation(id)
  }

  const handleDeleteConversation = async (id: string) => {
    await remove(id)
    if (activeId === id) {
      activate(null)
      clearMessages()
    }
  }

  const handleSend = async (content: string, effort: import("@/types/chat").ThinkingEffort = "high", model?: import("@/types/chat").Model) => {
    setInterrupted(false)
    if (!activeId) {
      pendingContent.current = { content, effort }
      const conv = await create(content.slice(0, 50))
      activate(conv.id)
    } else {
      sendMessage(content, effort, model)
    }
  }

  // Retry: find last user message and re-send
  const handleRetry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    if (!lastUser) return
    const content = lastUser.parts.find((p) => p.type === "text")?.content
    if (content) handleSend(content)
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex h-screen bg-[#EEF2FF] overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onNewChat={handleNewChat}
        onSelect={handleSelectConversation}
        onDelete={handleDeleteConversation}
      />

      <div className="flex flex-1 min-w-0 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          {hasMessages ? (
            <MessageList messages={messages} previewFile={previewFile} onPreviewFile={setPreviewFile} />
          ) : (
            <EmptyState onSend={handleSend} />
          )}

          {interrupted && !isLoading && (
            <div className="flex justify-center pb-2">
              <div className="flex items-center gap-2.5 bg-white border border-amber-200 text-amber-700 rounded-full px-4 py-2 text-[12px] shadow-sm">
                <span>Response was interrupted</span>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1 font-semibold hover:text-amber-900 transition-colors"
                >
                  <RotateCcw className="size-3" />
                  Retry
                </button>
              </div>
            </div>
          )}

          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>

        {previewFile && (
          <PreviewPanel file={previewFile} onClose={() => setPreviewFile(null)} />
        )}
      </div>
    </div>
  )
}
