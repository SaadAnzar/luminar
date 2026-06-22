import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(
  readFileSync(resolve(here, "../../backend/scripts/.dev-seed.json"), "utf8"),
) as { luminarId: string; token: string; user: object }

// Authenticate before any page script runs (the _authenticated guard reads localStorage).
test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    ([token, user]) => {
      localStorage.setItem("luminar_token", token as string)
      localStorage.setItem("luminar_user", user as string)
    },
    [seed.token, JSON.stringify(seed.user)] as const,
  )
})

test("watch player renders with chaptered timeline", async ({ page }) => {
  await page.goto(`/watch/${seed.luminarId}`)
  await expect(page.getByRole("heading", { name: "Photosynthesis, visually" })).toBeVisible()
  // Scene SVG is fetched and inlined into the player (no <object> — see SceneRenderer)
  await expect(page.locator(".aspect-video svg").first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible()
  // Sidebar tabs
  await expect(page.getByRole("tab", { name: "Scenes" })).toBeVisible()
  await page.waitForTimeout(800) // let entry animation settle
  await page.screenshot({ path: "e2e/__screens__/01-watch.png", fullPage: true })
})

test("quiz overlay gates at the scene boundary", async ({ page }) => {
  await page.goto(`/watch/${seed.luminarId}`)
  await page.getByRole("button", { name: "Play", exact: true }).click()
  // First gate is ~2.5s in (timer-driven, no audio in seed)
  await expect(page.getByText("Quick check")).toBeVisible({ timeout: 12_000 })
  await expect(page.getByText("What do plants convert light into")).toBeVisible()
  await page.screenshot({ path: "e2e/__screens__/02-quiz.png" })

  // Answer correctly and confirm feedback renders
  await page.getByRole("button", { name: /Chemical energy/ }).click()
  await page.getByRole("button", { name: "Submit" }).click()
  await expect(page.getByText("Correct!")).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: "e2e/__screens__/03-quiz-result.png" })
})
