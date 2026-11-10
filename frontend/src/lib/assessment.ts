import type { DraftQuestion } from "./schemas"

export function emptyQuestion(time_s: number | null = null): DraftQuestion {
  return { question: "", options: ["", "", "", ""], correct_index: 0, hint: "", explanation: "", time_s }
}
