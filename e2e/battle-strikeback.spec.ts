import { expect, test } from "@playwright/test"
import { Battle, BattlePhase } from "@/models/battle"
import { CreatureType } from "@/models/creature"
import { MasterboardPhase } from "@/models/game"
import { HexEdge, Terrain } from "@/models/masterboard"
import { forceNextRoll, seedGame } from "./fixtures"

test("a lethal Strikeback roll removes the killed creature once the phase advances", async ({ page }) => {
  await seedGame(page, 2, game => {
    game.activePhase = MasterboardPhase.BATTLE
    const battle = Battle.create({
      terrain: Terrain.PLAINS,
      edge: HexEdge.SECOND,
      attacking: { player: game.players[0].id, score: 0, creatures: [CreatureType.OGRE] },
      defending: { player: game.players[1].id, score: 0, creatures: [CreatureType.CENTAUR] }
    })
    // Land directly in the Attacker's Strikebacks phase: the Centaur already struck the Ogre
    // during Defender's Strikes, and now the un-struck, still-engaged Ogre owes it a strikeback.
    battle.phase = BattlePhase.ATTACKER_STRIKEBACK
    battle.activePlayer = game.players[0].id
    // Hexes 8 and 9 are adjacent on the interior battle board.
    battle.creatures[0].hex = 9
    battle.creatures[0].initialHex = 9
    battle.creatures[0].hasStruck = false
    battle.creatures[1].hex = 8
    battle.creatures[1].initialHex = 8
    battle.creatures[1].hasStruck = true
    // Centaur (strength 3) is already one hit from death.
    battle.creatures[1].wounds = 2
    game.activeBattle = battle
  })
  await page.goto("/")
  // Ogre needs 6s to hit the Centaur (skill 2 vs skill 4) - force a single 6 among its six dice
  // for exactly the one hit needed to finish the already-wounded Centaur off.
  await forceNextRoll(page, 6, 1, 1, 1, 1, 1)

  const battleboard = page.locator(".battleboard-root")
  await expect(battleboard).toBeVisible()
  await expect(battleboard.getByText("Attacker's Strikebacks")).toBeVisible()

  const board = battleboard.locator("svg.board")
  await board.locator(".battle-creature.ogre").click()
  await expect(board.locator(".engage-icon-root")).toBeVisible()
  await board.locator(".engage-icon-root").click()

  const strikeDialog = page.getByRole("dialog")
  await expect(strikeDialog.getByText("Attack Centaur with Ogre")).toBeVisible()
  await expect(strikeDialog).toContainText("roll 6 dice")
  await expect(strikeDialog).toContainText("roll 6s or better")
  await strikeDialog.getByRole("button", { name: "Attack" }).click()

  // The strikeback itself was lethal, but removal is deferred until the phase advances.
  await expect(board.locator(".battle-creature.centaur")).toHaveCount(1)
  await expect(board.locator(".battle-creature.centaur path.wounds")).toBeVisible()

  await page.getByRole("button", { name: "End Strikebacks" }).click()
  await expect(battleboard.getByText("Attacker's Move")).toBeVisible()
  await expect(board.locator(".battle-creature.centaur")).toHaveCount(0)
})
