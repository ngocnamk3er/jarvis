"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { apiFetch } from "@/lib/api-client"
import { Conversation } from "@/types/chat"

export function useConversations() {
  const { data: session, status } = useSession()
  const accessToken = session?.accessToken
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)

  const fetch_ = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await apiFetch("/api/v1/conversations", accessToken)
      if (!res.ok) return
      const data: Conversation[] = await res.json()
      setConversations(Array.isArray(data) ? data : [])
    } catch {
      // backend unavailable — leave list empty
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  const create = useCallback(async (title = "New conversation"): Promise<Conversation> => {
    const res = await apiFetch("/api/v1/conversations", accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) throw new Error(`Failed to create conversation: ${res.status}`)
    const conv: Conversation = await res.json()
    if (!conv?.id) throw new Error("Invalid conversation response")
    setConversations((prev) => {
      const safe = Array.isArray(prev) ? prev : []
      return [conv, ...safe.filter((c) => c.id !== conv.id)]
    })
    return conv
  }, [accessToken])

  const remove = useCallback(async (id: string) => {
    await apiFetch(`/api/v1/conversations/${id}`, accessToken, { method: "DELETE" })
    setConversations((prev) => prev.filter((c) => c.id !== id))
  }, [accessToken])

  const updateTitle = useCallback(async (id: string, title: string) => {
    await apiFetch(`/api/v1/conversations/${id}/title`, accessToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    )
  }, [accessToken])

  // The backend already persists last_model as a side effect of /chat/stream
  // (see chat.py's touch_conversation call) — this just mirrors that locally
  // so the sidebar/input reflect it immediately, without waiting on a refetch.
  const setLastModel = useCallback((id: string, modelId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, last_model: modelId } : c))
    )
  }, [])

  const setLastSubagentModel = useCallback((id: string, modelId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, last_subagent_model: modelId } : c))
    )
  }, [])

  useEffect(() => {
    if (status === "authenticated") fetch_()
  }, [status, fetch_])

  return { conversations, loading, refetch: fetch_, create, remove, updateTitle, setLastModel, setLastSubagentModel }
}
