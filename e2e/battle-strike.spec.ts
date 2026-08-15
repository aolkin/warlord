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

  // The Ogre is now engaged and un-struck, so it must strike back before the round can advance.
  // Ogre needs 6s to hit the Centaur (skill 2 vs skill 4) - force a miss so the Centaur survives
  // to take its fatal blow in the Attacker's Strikes phase below.
  await forceNextRoll(page, 1, 1, 1, 1, 1, 1)
  await board.locator(".battle-creature.ogre").click()
  await expect(board.locator(".engage-icon-root")).toBeVisible()
  await board.locator(".engage-icon-root").click()
  await expect(strikeDialog.getByText("Attack Centaur with Ogre")).toBeVisible()
  await expect(strikeDialog).toContainText("roll 6 dice")
  await expect(strikeDialog).toContainText("roll 6s or better")
  await strikeDialog.getByRole("button", { name: "Attack" }).click()

  await page.getByRole("button", { name: "End Strikebacks" }).click()
  await expect(battleboard.getByText("Attacker's Move")).toBeVisible()
  await page.getByRole("button", { name: "End Movement" }).click()
  await expect(battleboard.getByText("Attacker's Strikes")).toBeVisible()

  // Force a lethal hit on the Centaur (strength 3): three of the Ogre's six dice come up 6.
  await forceNextRoll(page, 6, 6, 6, 1, 1, 1)
  await board.locator(".battle-creature.ogre").click()
  await expect(board.locator(".engage-icon-root")).toBeVisible()
  await board.locator(".engage-icon-root").click()
  await expect(strikeDialog.getByText("Attack Centaur with Ogre")).toBeVisible()
  await strikeDialog.getByRole("button", { name: "Attack" }).click()

  // Rule 12: a slain creature stays on the board, and is still forced to strike back, until
  // strikebacks are done.
  await expect(board.locator(".battle-creature.centaur")).toHaveCount(1)
  await expect(board.locator(".battle-creature.centaur path.wounds")).toBeVisible()

  await page.getByRole("button", { name: "End Strikes" }).click()
  await expect(battleboard.getByText("Defender's Strikebacks")).toBeVisible()
  await expect(board.locator(".battle-creature.centaur")).toHaveCount(1)

  // The dead Centaur is still active-player-owned and engaged, so it must strike back too.
  await forceNextRoll(page, 1, 1, 1)
  await board.locator(".battle-creature.centaur").click()
  await expect(board.locator(".engage-icon-root")).toBeVisible()
  await board.locator(".engage-icon-root").click()
  await expect(strikeDialog.getByText("Attack Ogre with Centaur")).toBeVisible()
  await strikeDialog.getByRole("button", { name: "Attack" }).click()

  // Only once the Centaur's own strikeback resolves does it get removed from the board.
  await page.getByRole("button", { name: "End Strikebacks" }).click()
  await expect(board.locator(".battle-creature.centaur")).toHaveCount(0)
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
  // two rolls of exactly 4 exercises that boundary directly, rather than overshooting it.
  await forceNextRoll(page, 4, 4)

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
