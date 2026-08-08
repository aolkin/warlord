import { expect, test } from "@playwright/test"

// The app boots straight into a fresh 2-player game (no persisted save in localStorage),
// so the masterboard and both starting stacks are visible without any setup flow.
test("app loads, masterboard renders, and clicking a stack selects it", async ({ page }) => {
  await page.goto("/")

  const board = page.locator("svg.board")
  await expect(board).toBeVisible()

  const stacks = board.locator("g.marker")
  await expect(stacks).toHaveCount(2)

  const ownStack = board.locator("g.marker.owned")
  await ownStack.click()

  await expect(ownStack).toHaveClass(/selected/)
  await expect(page.getByRole("button", { name: "Previous Stack" })).toBeVisible()
})
