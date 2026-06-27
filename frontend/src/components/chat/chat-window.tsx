"use client"

import { useChat } from "@/hooks/use-chat"
import { Sidebar } from "./sidebar"
import { EmptyState } from "./empty-state"
import { MessageList } from "./message-list"
import { ChatInput } from "./chat-input"
import { UpgradeBanner } from "./upgrade-banner"

export function ChatWindow() {
  const { messages, isLoading, sendMessage, clearMessages } = useChat()
  const hasMessages = messages.length > 0

  return (
    <div className="flex h-screen bg-[#EEF2FF] overflow-hidden">
      <Sidebar onNewChat={clearMessages} />

      <div className="flex flex-1 min-w-0 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          {hasMessages ? (
            <MessageList messages={messages} />
          ) : (
            <EmptyState onSend={sendMessage} />
          )}
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
        <UpgradeBanner />
      </div>
    </div>
  )
}
