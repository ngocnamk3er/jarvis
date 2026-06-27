"use client"

import { useState, useEffect, useCallback } from "react"
import { Conversation } from "@/types/chat"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/v1/conversations`)
      const data = await res.json()
      setConversations(data)
    } finally {
      setLoading(false)
    }
  }, [])

  const create = useCallback(async (title = "New conversation"): Promise<Conversation> => {
    const res = await fetch(`${API_URL}/api/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    const conv = await res.json()
    setConversations((prev) => [conv, ...prev])
    return conv
  }, [])

  const remove = useCallback(async (id: string) => {
    await fetch(`${API_URL}/api/v1/conversations/${id}`, { method: "DELETE" })
    setConversations((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const updateTitle = useCallback(async (id: string, title: string) => {
    await fetch(`${API_URL}/api/v1/conversations/${id}/title`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    )
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  return { conversations, loading, refetch: fetch_, create, remove, updateTitle }
}
