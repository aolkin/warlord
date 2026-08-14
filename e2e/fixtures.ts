import { Page } from "@playwright/test"
import { TitanGame } from "@/models/game"
import { Random } from "@/models/random"

const GAME_STORAGE_KEY = "warlord-v1"

// TitanGame.create's default Random shuffles player colors and starting hexes via
// Math.random; a seeded test wants that assignment stable across runs instead.
const deterministicRandom: Random = {
  shuffle: collection => [...collection]
}

/**
 * Builds a TitanGame via TitanGame.create (optionally adjusted by `mutate`), then writes
 * it into localStorage before the app's own scripts run, so the next page.goto() boots
 * straight into that state instead of a fresh game. Call this before navigating.
 */
export async function seedGame(
  page: Page,
  numPlayers: number,
  mutate?: (game: TitanGame) => void
): Promise<TitanGame> {
  const game = TitanGame.create(numPlayers, deterministicRandom)
  mutate?.(game)
  const serialized = JSON.stringify(game)
  await page.addInitScript(([key, value]) => {
    window.localStorage.setItem(key, value)
  }, [GAME_STORAGE_KEY, serialized] as [string, string])
  return game
}

/**
 * Forces the next die roll(s) via DiceRoller.vue's window.DebugDice hook, bypassing the 3D
 * dice animation. DiceRoller resets this hook when it mounts, so this must run after
 * page.goto() rather than before.
 */
export async function forceNextRoll(page: Page, ...rolls: number[]): Promise<void> {
  await page.waitForFunction(() => "DebugDice" in window)
  await page.evaluate(rolls => {
    (window as unknown as { DebugDice: { nextRolls?: number[] } }).DebugDice.nextRolls = rolls
  }, rolls)
}
