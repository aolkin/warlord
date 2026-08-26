import { random, shuffle } from "lodash-es"

/**
 * Seam for gameplay-relevant randomness, so callers (tests, multiplayer's shared-seed
 * requirement) can swap in a deterministic implementation instead of Math.random.
 */
export interface Random {
  shuffle<T>(collection: readonly T[]): T[]
  die(): number
}

export const defaultRandom: Random = {
  shuffle: collection => shuffle(collection),
  die: () => {
    // @ts-expect-error window.DebugDice is a debug hook with no declared type
    const forced: number | undefined = window.DebugDice?.nextDie
    return forced ?? random(1, 6)
  },
}
