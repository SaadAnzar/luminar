/** Is in-browser MP4 export possible here at all? (Kept separate so the
 *  heavy encoder module only loads when an export actually starts.) */
export function exportSupported(): boolean {
  return typeof window !== "undefined" && "VideoEncoder" in window && "OfflineAudioContext" in window
}
