import { expect, test } from "@playwright/test"
import { forceNextRoll, seedGame } from "./fixtures"

// Titan + one Centaur/Ogre/Gargoyle satisfies Stack.isValidSplit for round 0 (4 creatures, one lord)
test("splitting the starting legion advances to Move with the new stack on the board", async ({ page }) => {
  await seedGame(page, 2)
  await page.goto("/")

  const board = page.locator("svg.board")
  await expect(board).toBeVisible()
  await expect(board.locator("g.marker")).toHaveCount(2)

  await board.locator("g.marker.owned").click()

  const panel = page.locator(".root-card")
  await expect(panel).toBeVisible()

  await panel.locator(".creature-root.titan").click()
  await panel.locator(".creature-root.centaur").first().click()
  await panel.locator(".creature-root.ogre").first().click()
  await panel.locator(".creature-root.gargoyle").first().click()

  await expect(panel.locator(".first-round-success")).toBeVisible()

  const finishButton = page.getByRole("button", { name: "Finish Splits and Roll" })
  await expect(finishButton).toBeEnabled()

  const angel = panel.locator(".creature-root.angel")
  await angel.click()
  await expect(finishButton).toBeDisabled()
  await expect(panel.locator(".first-round-success")).not.toBeVisible()

  await angel.click()
  await expect(finishButton).toBeEnabled()
  await expect(panel.locator(".first-round-success")).toBeVisible()

  await forceNextRoll(page, 3)
  await finishButton.click()

  await expect(board.locator("g.marker")).toHaveCount(3)
  await expect(board.locator("g.marker.owned")).toHaveCount(2)
  await expect(page.getByRole("button", { name: "Mulligan (Roll Again)" })).toBeVisible()
})
