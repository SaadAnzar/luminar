import { test } from "@playwright/test"

// No auth token set → landing renders (it redirects to /home only when logged in).
test("landing — light", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"))
  await page.goto("/")
  await page.waitForTimeout(1500) // let entry animations settle
  await page.screenshot({ path: "e2e/__screens__/landing-light.png", fullPage: true })
})

test("landing — dark", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"))
  await page.goto("/")
  await page.waitForTimeout(1500)
  await page.screenshot({ path: "e2e/__screens__/landing-dark.png", fullPage: true })
})

for (const theme of ["light", "dark"] as const) {
  test(`signin — ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t as string), theme)
    await page.goto("/signin")
    await page.waitForTimeout(900)
    await page.screenshot({ path: `e2e/__screens__/signin-${theme}.png`, fullPage: true })
  })
}
