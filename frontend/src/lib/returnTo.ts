/**
 * Remember where a signed-out visitor was headed (e.g. a shared assessment
 * link) so sign-in → onboarding lands them back there instead of /home.
 * sessionStorage survives the same-tab Google OAuth round trip.
 */
const KEY = "luminar_return_to"

function isSafePath(path: string): boolean {
  // Same-origin absolute paths only — never "//evil.com" or "https://…".
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/signin") && !path.startsWith("/auth/")
}

export function rememberReturnTo(path: string): void {
  try {
    if (isSafePath(path) && path !== "/") sessionStorage.setItem(KEY, path)
  } catch { /* storage unavailable — fall back to default landing */ }
}

/** Read and clear the remembered path (null if none or unsafe). */
export function consumeReturnTo(): string | null {
  try {
    const path = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return path && isSafePath(path) ? path : null
  } catch {
    return null
  }
}
