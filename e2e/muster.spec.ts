import { expect, test } from "@playwright/test"
import { CreatureType } from "@/models/creature"
import { MasterboardPhase, TitanGame } from "@/models/game"
import { seedGame } from "./fixtures"

// Player 0 starts at tower hex 100 (see move.spec.ts); hex 200 is a different tower left
// unoccupied by a 2-player game (TitanGame's INITIAL_HEXES[2] is [100, 400]). Moving the
// stack there without touching initialHex simulates a completed move onto Tower terrain,
// which always offers a free Centaur/Ogre/Gargoyle recruit regardless of stack composition
// (see Stack.musterable's Tower branch), so no path-following through Move is needed.
//
// The starting legion's 8 creatures already meet Stack.isFull's 7-creature cap, so mustering
// would be unavailable without first trimming it down, as if two creatures were lost in a
// prior battle.
test("mustering a moved stack at a tower adds the recruit and lets the turn end", async ({ page }) => {
  await seedGame(page, 2, game => {
    game.round = 1
    game.activePhase = MasterboardPhase.MUSTER
    const [stack] = TitanGame.getStacksForPlayer(game, game.activePlayerId)
    stack.creatures.splice(-2, 2)
    stack.hex = 200
  })
  await page.goto("/")

  const board = page.locator("svg.board")
  await expect(board).toBeVisible()
  await expect(board.locator("g.marker.player-0 .stack-size")).toHaveText("6")

  // Mustering is optional, so the turn can already end before any recruit is chosen.
  const endTurnButton = page.getByRole("button", { name: "End Turn" })
  await expect(endTurnButton).toBeEnabled()

  await board.locator("g.marker.owned").click()

  const panel = page.locator(".root-card")
  await expect(panel).toBeVisible()
  await expect(panel).toContainText("Player 1 (6 creatures)")
  await expect(panel).toContainText("Mustering Options (Tower)")
  await expect(panel).toContainText("No recruit chosen.")

  await panel.locator(".recruitment-choice.centaur").click()

  await expect(panel).toContainText("Mustering Centaur")
  await expect(board.locator("g.marker.owned .recruited-creature")).toBeVisible()

  await expect(endTurnButton).toBeEnabled()
  await endTurnButton.click()

  await expect(page.getByText("Player 2's Turn")).toBeVisible()
  await expect(board.locator("g.marker.player-0 .stack-size")).toHaveText("7")
})

// Hex 1000 is a Mountains hex. MUSTER_DATA[Terrain.MOUNTAINS] offers a Minotaur via either
// 2 Lions or an existing Minotaur, so a stack holding both bases makes Stack.musterable
// return more than one basis for that recruit, which is what opens MusterChoices.vue's
// basis-choice dialog instead of setting currentMuster on a single click.
test("mustering a recruit with more than one basis opens a choice dialog", async ({ page }) => {
  await seedGame(page, 2, game => {
    game.round = 1
    game.activePhase = MasterboardPhase.MUSTER
    const [stack] = TitanGame.getStacksForPlayer(game, game.activePlayerId)
    stack.creatures.splice(0, stack.creatures.length,
      CreatureType.TITAN, CreatureType.LION, CreatureType.LION, CreatureType.MINOTAUR,
      CreatureType.OGRE, CreatureType.GARGOYLE)
    stack.hex = 1000
  })
  await page.goto("/")

  const board = page.locator("svg.board")
  await expect(board).toBeVisible()

  // Mustering is optional, so the turn can already end before any recruit is chosen.
  const endTurnButton = page.getByRole("button", { name: "End Turn" })
  await expect(endTurnButton).toBeEnabled()

  await board.locator("g.marker.owned").click()

  const panel = page.locator(".root-card")
  await expect(panel).toBeVisible()
  await expect(panel).toContainText("Mustering Options (Mountains)")
  await expect(panel).toContainText("No recruit chosen.")

  await panel.locator(".recruitment-choice.minotaur").click()

  const dialog = page.locator(".v-card", { hasText: "Muster a Minotaur with..." })
  await expect(dialog).toBeVisible()

  await dialog.locator(".muster-basis-choice:has(.lion)").click()

  await expect(dialog).not.toBeVisible()
  await expect(panel).toContainText("Mustering Minotaur with 2x Lion")

  await expect(endTurnButton).toBeEnabled()
  await endTurnButton.click()

  await expect(page.getByText("Player 2's Turn")).toBeVisible()
  await expect(board.locator("g.marker.player-0 .stack-size")).toHaveText("7")
})
