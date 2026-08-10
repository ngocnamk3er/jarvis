import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { canRefresh } from "@/lib/keycloak-refresh-check"

export async function proxy(request: NextRequest) {
  const callbackUrl = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET })

  if (!token) {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url))
  }

  // Plain background API call to Keycloak (no browser redirect) — only
  // redirect to the login form if it actually comes back failed.
  const refreshToken = token.refreshToken as string | undefined
  const alive = refreshToken ? await canRefresh(refreshToken) : false
  if (!alive) {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  // api/verify-session is deliberately excluded: it needs to report
  // { active: false } as plain JSON for the focus watcher to act on, not
  // get swallowed into a redirect to the (HTML) login page by this same
  // check.
  matcher: ["/((?!api/auth|api/verify-session|login|_next/static|_next/image|favicon.ico|icon.svg|.well-known).*)"],
}
