// Server-only: needs AUTH_KEYCLOAK_SECRET, never expose to the client.
// Same mechanism the reference project (keycloak-js's updateToken()) uses:
// attempt a refresh_token grant and treat failure as "session dead" — no
// separate introspection endpoint. Verified live: reusing the same refresh
// token twice still succeeds (Keycloak doesn't rotate/invalidate it on use
// in this realm's default config), so calling this purely to probe
// liveness — without persisting the tokens it returns — is safe and won't
// break the real session.
const KEYCLOAK_ISSUER = process.env.AUTH_KEYCLOAK_ISSUER ?? "http://localhost:8180/realms/jarvis"

export async function canRefresh(refreshToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_KEYCLOAK_ID!,
        client_secret: process.env.AUTH_KEYCLOAK_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    })
    return res.ok
  } catch {
    // Keycloak unreachable — fail open rather than locking everyone out
    // over a transient network blip.
    return true
  }
}
