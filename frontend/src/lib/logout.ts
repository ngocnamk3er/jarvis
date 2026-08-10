import { signOut } from "next-auth/react"

const KEYCLOAK_ISSUER = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ?? "http://localhost:8180/realms/jarvis"

export async function logout(idToken?: string | null) {
  await signOut({ redirect: false })
  const params = new URLSearchParams({
    post_logout_redirect_uri: window.location.origin,
    ...(idToken ? { id_token_hint: idToken } : {}),
  })
  window.location.href = `${KEYCLOAK_ISSUER}/protocol/openid-connect/logout?${params.toString()}`
}
