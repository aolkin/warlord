import { expect, test } from "@playwright/test"
import { Battle, BattlePhase } from "@/models/battle"
import { CreatureType } from "@/models/creature"
import { MasterboardPhase } from "@/models/game"
import { HexEdge, Terrain } from "@/models/masterboard"
import { forceNextRoll, seedGame } from "./fixtures"

test("a melee Strike deals damage to an adjacent target and advances the phase on a forced hit", async ({ page }) => {
  await seedGame(page, 2, game => {
    game.activePhase = MasterboardPhase.BATTLE
    const battle = Battle.create({
      terrain: Terrain.PLAINS,
      edge: HexEdge.SECOND,
      attacking: { player: game.players[0].id, score: 0, creatures: [CreatureType.OGRE] },
      defending: { player: game.players[1].id, score: 0, creatures: [CreatureType.CENTAUR] }
    })
    battle.phase = BattlePhase.DEFENDER_STRIKE
    battle.activePlayer = game.players[1].id
    // Hexes 8 and 9 are adjacent on the interior battle board.
    battle.creatures[0].hex = 9
    battle.creatures[0].initialHex = 9
    battle.creatures[1].hex = 8
    battle.creatures[1].initialHex = 8
    game.activeBattle = battle
  })
  await page.goto("/")
  // Centaur rolls 3 dice (its strength) and needs 2s or better against the Ogre - forcing
  // three 6s guarantees a hit regardless of the exact to-hit number.
  await forceNextRoll(page, 6, 6, 6)

  const battleboard = page.locator(".battleboard-root")
  await expect(battleboard).toBeVisible()
  await expect(battleboard.getByText("Defender's Strikes")).toBeVisible()

  const board = battleboard.locator("svg.board")
  await board.locator(".battle-creature.centaur").click()
  await expect(board.locator(".engage-icon-root")).toBeVisible()
  await board.locator(".engage-icon-root").click()

  const strikeDialog = page.getByRole("dialog")
  await expect(strikeDialog.getByText("Attack Ogre with Centaur")).toBeVisible()
  await expect(strikeDialog).toContainText("roll 3 dice")
  await expect(strikeDialog).toContainText("roll 2s or better")
  await strikeDialog.getByRole("button", { name: "Attack" }).click()

  await expect(board.locator(".battle-creature.ogre .wounds.number")).toHaveText("3")

  await page.getByRole("button", { name: "End Strikes" }).click()
  await expect(battleboard.getByText("Attacker's Strikebacks")).toBeVisible()
})

test("a Rangestrike hits a non-adjacent target and advances the phase on a forced hit", async ({ page }) => {
  await seedGame(page, 2, game => {
    game.activePhase = MasterboardPhase.BATTLE
    const battle = Battle.create({
      terrain: Terrain.PLAINS,
      edge: HexEdge.SECOND,
      attacking: { player: game.players[0].id, score: 0, creatures: [CreatureType.CENTAUR] },
      defending: { player: game.players[1].id, score: 0, creatures: [CreatureType.MINOTAUR] }
    })
    battle.phase = BattlePhase.DEFENDER_STRIKE
    battle.activePlayer = game.players[1].id
    // Hexes 8 and 16 are two hexes apart (not adjacent, not long-distance) on the interior board.
    battle.creatures[0].hex = 16
    battle.creatures[0].initialHex = 16
    battle.creatures[1].hex = 8
    battle.creatures[1].initialHex = 8
    game.activeBattle = battle
  })
  await page.goto("/")
  // Minotaur rangestrikes with 2 dice (half its strength) and needs 4s or better - forcing
  // two 6s guarantees a hit regardless of the exact to-hit number.
  await forceNextRoll(page, 6, 6)

  const battleboard = page.locator(".battleboard-root")
  await expect(battleboard).toBeVisible()
  await expect(battleboard.getByText("Defender's Strikes")).toBeVisible()

  const board = battleboard.locator("svg.board")
  await board.locator(".battle-creature.minotaur").click()
  await expect(board.locator(".rangestrike-icon-root")).toBeVisible()
  await board.locator(".rangestrike-icon-root").click()

  const rangestrikeDialog = page.getByRole("dialog")
  await expect(rangestrikeDialog.getByText("Rangestrike Centaur with Minotaur")).toBeVisible()
  await expect(rangestrikeDialog).toContainText("roll 2 dice")
  await expect(rangestrikeDialog).toContainText("roll 4s or better")
  await rangestrikeDialog.getByRole("button", { name: "Attack" }).click()

  await expect(board.locator(".battle-creature.centaur .wounds.number")).toHaveText("2")

  await page.getByRole("button", { name: "End Strikes" }).click()
  // Neither creature is engaged in melee, so both intervening strikeback phases auto-skip.
  await expect(battleboard.getByText("Attacker's Move")).toBeVisible()
})
