import { test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(
  readFileSync(resolve(here, "../../backend/scripts/.dev-seed.json"), "utf8"),
) as { luminarId: string; userId: string; token: string; user: object }

function auth(theme: "light" | "dark") {
  return async ({ context }: { context: import("@playwright/test").BrowserContext }) => {
    await context.addInitScript(
      ([token, user, t]) => {
        localStorage.setItem("luminar_token", token as string)
        localStorage.setItem("luminar_user", user as string)
        localStorage.setItem("theme", t as string)
      },
      [seed.token, JSON.stringify(seed.user), theme] as const,
    )
  }
}

for (const theme of ["light", "dark"] as const) {
  test.describe(theme, () => {
    test.beforeEach(auth(theme))

    test(`home ${theme}`, async ({ page }) => {
      await page.goto("/home")
      await page.getByRole("heading", { name: /Welcome back/ }).waitFor()
      await page.waitForTimeout(900)
      await page.screenshot({ path: `e2e/__screens__/home-${theme}.png`, fullPage: true })
    })

    test(`profile ${theme}`, async ({ page }) => {
      await page.goto(`/profile/${seed.userId}`)
      await page.waitForTimeout(1000)
      await page.screenshot({ path: `e2e/__screens__/profile-${theme}.png`, fullPage: true })
    })

    test(`watch ${theme}`, async ({ page }) => {
      await page.goto(`/watch/${seed.luminarId}`)
      await page.waitForTimeout(1200)
      await page.screenshot({ path: `e2e/__screens__/watch-${theme}.png`, fullPage: true })
    })

    test(`discover ${theme}`, async ({ page }) => {
      await page.goto("/discover")
      await page.waitForTimeout(1000)
      await page.screenshot({ path: `e2e/__screens__/discover-${theme}.png`, fullPage: true })
    })

    test(`create ${theme}`, async ({ page }) => {
      await page.goto("/create")
      await page.waitForTimeout(900)
      await page.screenshot({ path: `e2e/__screens__/create-${theme}.png`, fullPage: true })
    })

    test(`onboarding ${theme}`, async ({ page }) => {
      await page.goto("/onboarding")
      await page.waitForTimeout(900)
      await page.screenshot({ path: `e2e/__screens__/onboarding-${theme}.png`, fullPage: true })
    })
  })
}
