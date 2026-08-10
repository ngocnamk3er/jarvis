import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { canRefresh } from "@/lib/keycloak-refresh-check"

// Deliberately outside /api/auth/* (NextAuth's own catch-all route would
// otherwise intercept it). Called by the tab-focus watcher — a plain check,
// no redirect here; the caller decides what to do with { active: false }.
export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET })
  const refreshToken = token?.refreshToken as string | undefined
  if (!refreshToken) {
    return NextResponse.json({ active: false })
  }
  const active = await canRefresh(refreshToken)
  return NextResponse.json({ active })
}
