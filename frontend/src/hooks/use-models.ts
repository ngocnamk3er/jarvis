"use client"

import { useState, useEffect } from "react"
import { Model } from "@/types/chat"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export function useModels() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/chat/models`)
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
