import NextAuth from "next-auth"
import Keycloak from "next-auth/providers/keycloak"
import type { JWT } from "next-auth/jwt"
import { ACCESS_TOKEN_MIN_VALIDITY_MS } from "@/lib/auth-constants"

const KEYCLOAK_ISSUER = process.env.AUTH_KEYCLOAK_ISSUER ?? "http://localhost:8180/realms/jarvis"

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(`${KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_KEYCLOAK_ID!,
        client_secret: process.env.AUTH_KEYCLOAK_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken!,
      }),
    })
    const refreshed = await res.json()
    if (!res.ok) throw refreshed

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpiresAt: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    }
  } catch {
    return { ...token, error: "RefreshAccessTokenError" as const }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      issuer: KEYCLOAK_ISSUER,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          accessTokenExpiresAt: (account.expires_at ?? 0) * 1000,
        }
      }
      // keycloak-js's updateToken(10)-style check: refresh once fewer than
      // ACCESS_TOKEN_MIN_VALIDITY_MS remain, not only once actually expired.
      if (Date.now() < (token.accessTokenExpiresAt ?? 0) - ACCESS_TOKEN_MIN_VALIDITY_MS) {
        return token
      }
      return refreshAccessToken(token)
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.idToken = token.idToken
      session.error = token.error
      return session
    },
  },
})
