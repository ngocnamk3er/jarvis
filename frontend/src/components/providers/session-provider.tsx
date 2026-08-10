"use client"

import { useEffect } from "react"
import { SessionProvider, useSession, signOut } from "next-auth/react"
import type { Session } from "next-auth"

// The Keycloak SSO session can die independently of our own session cookie
// (e.g. the user logs out from another app sharing this Keycloak realm, or
// from the Account Console). We only find out by actually asking Keycloak —
// see the two watchers below, both of which are plain background API calls
// that never redirect on their own; they only force a sign-out (which then
// redirects to /login) once the check actually comes back negative.

// A background access-token refresh (see auth.ts's ACCESS_TOKEN_MIN_VALIDITY_MS
// check, driven by SessionProvider's refetchInterval below) can fail if the
// session backing the refresh token is gone — auth.ts records that as
// session.error. This reacts to it.
function SessionErrorWatcher() {
  const { data: session } = useSession()

  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      signOut({ redirect: true, callbackUrl: "/" })
    }
  }, [session?.error])

  return null
}

// Same idea as proxy.ts (which checks on every page load), but triggered by
// the tab regaining focus/visibility — so a logout that happened elsewhere
// while this tab sat in the background is caught as soon as the user
// switches back to it, not only on their next manual reload. Just an API
// call; only signs out if it comes back inactive.
function SsoFocusWatcher() {
  const { data: session } = useSession()

  useEffect(() => {
    if (!session) return

    async function checkOnFocus() {
      if (document.visibilityState !== "visible") return
      try {
        const res = await fetch("/api/verify-session")
        const data = await res.json()
        if (!data.active) {
          signOut({ redirect: true, callbackUrl: "/" })
        }
      } catch {
        // Keycloak/network blip — fail open, same reasoning as
        // canRefresh() itself.
      }
    }

    document.addEventListener("visibilitychange", checkOnFocus)
    window.addEventListener("focus", checkOnFocus)
    return () => {
      document.removeEventListener("visibilitychange", checkOnFocus)
      window.removeEventListener("focus", checkOnFocus)
    }
  }, [session])

  return null
}

export function AuthSessionProvider({
  session,
  children,
}: {
  session: Session | null
  children: React.ReactNode
}) {
  return (
    // refetchInterval drives auth.ts's ACCESS_TOKEN_MIN_VALIDITY_MS check —
    // periodically re-reads the session so a token within 30s of expiring
    // gets refreshed proactively in the background. 20s matches the
    // reference project's setInterval(..., 20000).
    <SessionProvider session={session} refetchInterval={20} refetchOnWindowFocus>
      <SessionErrorWatcher />
      <SsoFocusWatcher />
      {children}
    </SessionProvider>
  )
}
