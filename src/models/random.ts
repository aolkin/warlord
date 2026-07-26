import { shuffle } from "lodash-es"

/**
 * Seam for gameplay-relevant randomness, so callers (tests, multiplayer's shared-seed
 * requirement) can swap in a deterministic implementation instead of Math.random.
 */
export interface Random {
  shuffle<T>(collection: readonly T[]): T[]
}

export const defaultRandom: Random = {
  shuffle: collection => shuffle(collection)
}
