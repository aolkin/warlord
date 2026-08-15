import { expect, test } from "@playwright/test"
import { Battle } from "@/models/battle"
import { CreatureType } from "@/models/creature"
import { MasterboardPhase } from "@/models/game"
import { HexEdge, Terrain } from "@/models/masterboard"
import { seedGame } from "./fixtures"

// Mountains hex 15 is a Volcano only a Dragon may enter (Battle.creatureMovementCost returns
// UNATTAINABLE_MOVEMENT_COST for anyone else) and also sits behind a Cliff edge to hex 20 -
// impassable outright to any non-flying creature, regardless of hazard nativity. Entering at
// HexEdge.SECOND puts a Centaur (skill 4, native to nothing on this board) within reach of hex 8
// with exactly enough movement left to cross the Slope onto hex 15, so hex 15's absence below is
// the hazard rule at work, not a movement-range shortfall.
test("a non-flying creature's Battle Move on Mountains excludes hazard-blocked hexes and doesn't strand a moved creature off-board", async ({ page }) => {
  await seedGame(page, 2, game => {
    game.activePhase = MasterboardPhase.BATTLE
    game.activeBattle = Battle.create({
      terrain: Terrain.MOUNTAINS,
      edge: HexEdge.SECOND,
      attacking: { player: game.players[0].id, score: 0, creatures: [CreatureType.TROLL, CreatureType.GIANT] },
      defending: { player: game.players[1].id, score: 0, creatures: [CreatureType.CENTAUR, CreatureType.OGRE] }
    })
  })
  await page.goto("/")

  const battleboard = page.locator(".battleboard-root")
  await expect(battleboard).toBeVisible()
  await expect(battleboard.getByText("Defender's Move")).toBeVisible()
  await expect(battleboard).toContainText("You have 2 creatures that have not entered the battle board")

  await battleboard.locator(".creature-root.pending.centaur").click()

  const board = battleboard.locator("svg.board")
  await expect(board.locator("g.available-move.hex-15")).toHaveCount(0)
  await expect(board.locator("g.available-move.hex-20")).toBeVisible()

  await board.locator("g.hex-20").click()
  await expect(battleboard).toContainText("You have 1 creature that has not entered the battle board")

  await battleboard.locator(".creature-root.pending.ogre").click()
  await expect(board.locator("g.available-move.hex-3")).toBeVisible()
  await board.locator("g.hex-3").click()
  await expect(battleboard).not.toContainText("entered the battle board")

  await page.getByRole("button", { name: "End Movement" }).click()

  await expect(battleboard.getByText("Attacker's Move")).toBeVisible()
  await expect(board.locator("g.battle-creature.centaur")).toBeVisible()
  await expect(board.locator("g.battle-creature.ogre")).toBeVisible()
})
