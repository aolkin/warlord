import { TitanGame } from "./game"
import { Random } from "./random"

export const noShuffleRandom: Random = { shuffle: collection => [...collection] }

export function newGame(numPlayers = 2): TitanGame {
  const game = new TitanGame(numPlayers, noShuffleRandom)
  // Actions persist as a side effect; persistence itself is a separate concern (see
  // persistence.ts) and not under test here, so stub it out rather than exercising
  // the real localStorage/compression path for every turn/muster action.
  game.persist = async () => undefined
  return game
}
