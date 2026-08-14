import { expect, test } from "@playwright/test"
import { MasterboardPhase, TitanGame } from "@/models/game"
import { Stack } from "@/models/stack"
import { seedGame } from "./fixtures"

// Player 0 (BLUE, no-shuffle random) starts at tower hex 100, one of whose 3 roll-1 exits is
// hex 3 (see TitanGame.getPathsForHex unit tests in src/game/models/game.test.ts).
test("a stack must move off a hex it split from before Move phase can advance", async ({ page }) => {
  await seedGame(page, 2, game => {
    game.round = 1 // round 0 would show the Mulligan button instead of Proceed
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1
    const [original] = TitanGame.getStacksForPlayer(game, game.activePlayerId)
    // Mimics the result of a split: two same-owner stacks sharing a hex, neither moved yet.
    game.stacks.push(Stack.create({
      owner: original.owner,
      hex: original.hex,
      marker: TitanGame.getNextMarker(game)!,
      createdRound: game.round
    }))
  })
  await page.goto("/")

  const board = page.locator("svg.board")
  await expect(board).toBeVisible()
  await expect(board.locator("g.marker.owned")).toHaveCount(2)
  await expect(board.locator("g.marker.mandatory")).toHaveCount(2)

  const proceedButton = page.getByRole("button", { name: "Proceed to Muster" })
  await expect(proceedButton).toBeDisabled()

  // The two stacks sit on the same hex with only a slight rotational offset (see
  // MasterboardStack.vue's transform for stacks sharing a hex), so their bounding boxes
  // overlap and a coordinate-based click can land on the other marker instead. Dispatching
  // the event directly on the element sidesteps the hit-test.
  await board.locator("g.marker.owned").first().dispatchEvent("click")
  await board.locator("g.destination").first().click()

  await expect(board.locator("g.marker.mandatory")).toHaveCount(0)
  await expect(proceedButton).toBeEnabled()

  await proceedButton.click()
  await expect(page.getByRole("button", { name: "End Turn" })).toBeVisible()
})

test("moving onto an enemy-occupied hex engages it, and Proceed to Battle starts the fight", async ({ page }) => {
  await seedGame(page, 2, game => {
    game.round = 1
    game.activePhase = MasterboardPhase.MOVE
    game.activeRoll = 1
    const [, enemy] = game.stacks
    enemy.hex = 3
    enemy.initialHex = 3
  })
  await page.goto("/")

  const board = page.locator("svg.board")
  await expect(board).toBeVisible()
  await expect(board.locator("g.marker")).toHaveCount(2)

  await board.locator("g.marker.owned").click()

  const engageIcon = board.locator("g.marker.engageable .rangestrike-icon-container.interactive")
  await expect(engageIcon).toBeVisible()
  // Neighboring hexes' markers can overlap in the SVG, so dispatch directly on the icon
  // rather than relying on a coordinate-based click landing on the right element.
  await engageIcon.dispatchEvent("click")

  await expect(board.locator("g.marker.owned.engaged")).toBeVisible()

  const proceedButton = page.getByRole("button", { name: "Proceed to Battle" })
  await expect(proceedButton).toBeEnabled()
  await proceedButton.click()

  await expect(page.locator(".battleboard-root")).toBeVisible()
})
