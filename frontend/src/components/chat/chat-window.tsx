"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { useChat, useLoadingThreadIds } from "@/hooks/use-chat"
import { useConversations } from "@/hooks/use-conversations"
import { useModels } from "@/hooks/use-models"
import { Sidebar } from "./sidebar"
import { EmptyState } from "./empty-state"
import { MessageList } from "./message-list"
import { ChatInput } from "./chat-input"
import { ClarifyRequest } from "./clarify-request"

// Module-level set to track which threads have already had history loaded
// (avoids re-fetching when switching back to a conversation mid-stream)
const _historyLoaded = new Set<string>()

export function ChatWindow() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const { conversations, create, remove, setLastModel, setLastSubagentModel } = useConversations()
  const { models } = useModels()
  const [activeId, setActiveId] = useState<string | null>(null)
  const pendingContent = useRef<{
    content: string
    effort: import("@/types/chat").ThinkingEffort
    model?: import("@/types/chat").Model
    subagentModel?: import("@/types/chat").Model
  } | null>(null)
  // Set synchronously (a ref, not state) the moment a message is sent, so a
  // brand-new conversation's ChatInput — which remounts as soon as activeId
  // changes to the newly created id — reads the right model on its very
  // first render. Waiting on `conversations` state (updated via setLastModel,
  // which only lands a render later) let ChatInput's own "default the model"
  // effect fire first with the stale/missing value, flashing DeepSeek Flash
  // before correcting itself once the state caught up.
  const lastSentModel = useRef<Map<string, string>>(new Map())
  const lastSentSubagentModel = useRef<Map<string, string>>(new Map())

  const { messages, isLoading, pendingClarify, interrupted, stopped, contextTokens, sendMessage, resumeClarify, stopMessage, loadHistory } = useChat(activeId)
  const loadingThreadIds = useLoadingThreadIds()

  async function openConversation(id: string) {
    // Skip if already loaded (may be mid-stream when switching back)
    if (_historyLoaded.has(id)) return
    _historyLoaded.add(id)
    await loadHistory(id)
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
      const { content, effort, model, subagentModel } = pendingContent.current
      if (model) setLastModel(activeId, model.id)
      if (subagentModel) setLastSubagentModel(activeId, subagentModel.id)
      sendMessage(content, effort, model, subagentModel)
      pendingContent.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, sendMessage])

  function activate(id: string | null) {
    setActiveId(id)
    router.replace(id ? `/?c=${id}` : "/")
  }

  const handleNewChat = () => {
    activate(null)
  }

  const handleSelectConversation = async (id: string) => {
    activate(id)
    await openConversation(id)
  }

  const handleDeleteConversation = async (id: string) => {
    await remove(id)
    _historyLoaded.delete(id)
    if (activeId === id) {
      activate(null)
    }
  }

  const handleSend = async (
    content: string,
    effort: import("@/types/chat").ThinkingEffort = "high",
    model?: import("@/types/chat").Model,
    subagentModel?: import("@/types/chat").Model
  ) => {
    if (!activeId) {
      pendingContent.current = { content, effort, model, subagentModel }
      const conv = await create(content.slice(0, 50))
      if (model) lastSentModel.current.set(conv.id, model.id)
      if (subagentModel) lastSentSubagentModel.current.set(conv.id, subagentModel.id)
      _historyLoaded.add(conv.id)  // Mark as loaded so we don't fetch history for brand-new thread
      activate(conv.id)
    } else {
      if (model) {
        lastSentModel.current.set(activeId, model.id)
        setLastModel(activeId, model.id)
      }
      if (subagentModel) {
        lastSentSubagentModel.current.set(activeId, subagentModel.id)
        setLastSubagentModel(activeId, subagentModel.id)
      }
      sendMessage(content, effort, model, subagentModel)
    }
  }

  // Same model this conversation is already using — resuming a clarify
  // answer must carry it forward explicitly, since the backend has no other
  // way to know which model to continue with (see chat_service.resume_clarify).
  const resumeModelId =
    (activeId && lastSentModel.current.get(activeId)) ??
    conversations.find((c) => c.id === activeId)?.last_model ??
    null
  const resumeModel = models.find((m) => m.id === resumeModelId)

  const resumeSubagentModelId =
    (activeId && lastSentSubagentModel.current.get(activeId)) ??
    conversations.find((c) => c.id === activeId)?.last_subagent_model ??
    null
  const resumeSubagentModel = models.find((m) => m.id === resumeSubagentModelId)

  // Live value from this session's SSE stream overrides; else fall back to
  // whatever was last persisted (loaded once via useConversations() on
  // mount) — same pattern as resumeModelId above.
  const displayedContextTokens =
    contextTokens ?? conversations.find((c) => c.id === activeId)?.context_tokens ?? 0

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
        loadingThreadIds={loadingThreadIds}
        onNewChat={handleNewChat}
        onSelect={handleSelectConversation}
        onDelete={handleDeleteConversation}
      />

      <div className="flex flex-1 min-w-0 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          {hasMessages ? (
            <MessageList messages={messages} />
          ) : (
            <EmptyState />
          )}

          {pendingClarify && !isLoading && (
            <ClarifyRequest
              clarify={pendingClarify}
              onAnswer={(answer) => resumeClarify(answer, resumeModel, resumeSubagentModel)}
            />
          )}

          {(interrupted || stopped) && !isLoading && !pendingClarify && (
            <div className="flex justify-center pb-2">
              <div className="flex items-center gap-2.5 bg-white border border-amber-200 text-amber-700 rounded-full px-4 py-2 text-[12px] shadow-sm">
                <span>{stopped ? "Stopped" : "Response was interrupted"}</span>
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

          <ChatInput
            key={activeId}
            onSend={handleSend}
            disabled={isLoading || !!pendingClarify}
            isLoading={isLoading}
            onStop={stopMessage}
            initialModelId={
              (activeId && lastSentModel.current.get(activeId)) ??
              conversations.find((c) => c.id === activeId)?.last_model ??
              null
            }
            initialSubagentModelId={
              (activeId && lastSentSubagentModel.current.get(activeId)) ??
              conversations.find((c) => c.id === activeId)?.last_subagent_model ??
              null
            }
            hasMessages={hasMessages}
            contextTokens={displayedContextTokens}
          />
        </div>
      </div>
    </div>
  )
}
