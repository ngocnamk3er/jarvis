"use client"

import { useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"

export default function LoginPage() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/"
  // signIn() generates a fresh PKCE verifier cookie and navigates away —
  // calling it twice (e.g. React StrictMode double-invoking this effect in
  // dev) overwrites that cookie mid-flight, so an in-flight first attempt's
  // authorization code no longer matches it ("PKCE verification failed:
  // Code mismatch"). Guard so only the first call actually fires.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    signIn("keycloak", { callbackUrl })
  }, [callbackUrl])

  return null
}
