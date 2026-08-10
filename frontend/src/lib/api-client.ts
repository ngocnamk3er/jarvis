export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export function apiFetch(pathOrUrl: string, accessToken: string | null | undefined, init: RequestInit = {}) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_URL}${pathOrUrl}`
  const headers = new Headers(init.headers)
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`)
  return fetch(url, { ...init, headers })
}
