"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "@/hooks/use-chat"
import { useConversations } from "@/hooks/use-conversations"
import { Sidebar } from "./sidebar"
import { EmptyState } from "./empty-state"
import { MessageList } from "./message-list"
import { ChatInput } from "./chat-input"
import { UpgradeBanner } from "./upgrade-banner"

export function ChatWindow() {
  const { conversations, create, remove } = useConversations()
  const [activeId, setActiveId] = useState<string | null>(null)
  const pendingContent = useRef<string | null>(null)

  const { messages, isLoading, sendMessage, clearMessages, loadHistory } = useChat(activeId)

  useEffect(() => {
    if (activeId && pendingContent.current) {
      sendMessage(pendingContent.current)
      pendingContent.current = null
    }
  }, [activeId, sendMessage])

  const handleNewChat = async () => {
    const conv = await create()
    setActiveId(conv.id)
    clearMessages()
  }

  const handleSelectConversation = async (id: string) => {
    setActiveId(id)
    await loadHistory(id)
  }

  const handleDeleteConversation = async (id: string) => {
    await remove(id)
    if (activeId === id) {
      setActiveId(null)
      clearMessages()
    }
  }

  const handleSend = async (content: string) => {
    if (!activeId) {
      pendingContent.current = content
      const conv = await create(content.slice(0, 50))
      setActiveId(conv.id)
    } else {
      sendMessage(content)
    }
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
            <MessageList messages={messages} />
          ) : (
            <EmptyState onSend={handleSend} />
          )}
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>
        <UpgradeBanner />
      </div>
    </div>
  )
}
