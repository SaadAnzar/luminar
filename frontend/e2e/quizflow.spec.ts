import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(
  readFileSync(resolve(here, "../../backend/scripts/.dev-seed.json"), "utf8"),
) as { luminarId: string; token: string; user: object }

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    ([token, user]) => {
      localStorage.setItem("luminar_token", token as string)
      localStorage.setItem("luminar_user", user as string)
      localStorage.setItem("theme", "dark")
    },
    [seed.token, JSON.stringify(seed.user)] as const,
  )
})

// Synthetic seed: 3 short scenes (timer-driven), quiz on scene 0 and scene 1.
test("full quiz cycle: auto-pop → continue → autoplay → next quiz → finish", async ({ page }) => {
  await page.goto(`/watch/${seed.luminarId}`)
  await page.getByRole("button", { name: "Play", exact: true }).click()

  // Quiz 1 auto-pops at scene-0 boundary
  await expect(page.getByText("What do plants convert light into")).toBeVisible({ timeout: 12_000 })
  await page.getByRole("button", { name: /Chemical energy/ }).click()
  await page.getByRole("button", { name: "Submit" }).click()
  await expect(page.getByText("Correct!")).toBeVisible({ timeout: 8000 })

  // Continue → resumes + autoplays scene 1 → quiz 2 auto-pops (the cycle repeats)
  await page.getByRole("button", { name: /Continue/ }).click()
  await expect(page.getByText("Where are photons captured")).toBeVisible({ timeout: 12_000 })
  await expect(page.getByText("What do plants convert light into")).toBeHidden()

  await page.getByRole("button", { name: /Thylakoid/ }).click()
  await page.getByRole("button", { name: "Submit" }).click()
  await expect(page.getByText(/Correct!|Not quite/)).toBeVisible({ timeout: 8000 })
  await page.getByRole("button", { name: /Continue/ }).click()

  // After the last scene, the completion overlay appears
  await expect(page.getByText("Luminar complete")).toBeVisible({ timeout: 12_000 })
})
