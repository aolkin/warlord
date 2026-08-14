import { expect, test } from "@playwright/test"
import { forceNextRoll, seedGame } from "./fixtures"

// Round 0, split phase: each player starts with a single 8-creature legion (including two
// lords - the Titan and an Angel) that must split into two stacks of at least 2 before the
// game will let them roll. The active player's legion always has exactly one of each other
// creature type, so picking the Titan plus one Centaur, Ogre, and Gargoyle produces a valid
// first-round split (four creatures, exactly one lord) per Stack.isValidSplit.
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
  await forceNextRoll(page, 3)
  await finishButton.click()

  await expect(board.locator("g.marker")).toHaveCount(3)
  await expect(board.locator("g.marker.owned")).toHaveCount(2)
  await expect(page.getByRole("button", { name: "Mulligan (Roll Again)" })).toBeVisible()
})
