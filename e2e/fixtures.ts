import { Page } from "@playwright/test"
import { TitanGame } from "@/models/game"
import { Random } from "@/models/random"

const GAME_STORAGE_KEY = "warlord-v1"

// TitanGame.create defaults to Math.random-based shuffling
const deterministicRandom: Random = {
  shuffle: collection => [...collection],
  die: () => 1
}

// writes to localStorage via addInitScript, so call this before page.goto()
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

// DiceRoller resets this hook on mount, so call after page.goto(), not before
export async function forceNextRoll(page: Page, ...rolls: number[]): Promise<void> {
  await page.waitForFunction(() => "DebugDice" in window)
  await page.evaluate(rolls => {
    const debugDice = (window as unknown as { DebugDice: { nextRolls?: number[]; nextDie?: number } }).DebugDice
    debugDice.nextRolls = rolls
    debugDice.nextDie = rolls[0]
  }, rolls)
}
