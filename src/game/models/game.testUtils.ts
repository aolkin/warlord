import { TitanGame } from "./game"
import { Random } from "./random"

export const noShuffleRandom: Random = { shuffle: collection => [...collection] }

export function newGame(numPlayers = 2): TitanGame {
  return new TitanGame(numPlayers, noShuffleRandom)
}
