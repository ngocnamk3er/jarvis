"use client"

import { useState, useEffect } from "react"
import { apiFetch } from "@/lib/api-client"
import { Model } from "@/types/chat"

export function useModels() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // /chat/models is static config, deliberately left unauthenticated
        const res = await apiFetch("/api/v1/chat/models", null)
        if (!res.ok) return
        const data: Model[] = await res.json()
        if (!cancelled) setModels(Array.isArray(data) ? data : [])
      } catch {
        // backend unavailable — leave list empty
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return { models, loading }
}
