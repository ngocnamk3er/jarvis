// keycloak-js's classic updateToken(minValidity) pattern: refresh the
// access token proactively once fewer than this many ms of validity remain,
// rather than waiting for it to actually expire. Matches the reference
// project's own setInterval(() => keycloak.updateToken(30), 20000) — same
// 30s minValidity, paired with a 20s poll interval in session-provider.tsx.
export const ACCESS_TOKEN_MIN_VALIDITY_MS = 30_000
