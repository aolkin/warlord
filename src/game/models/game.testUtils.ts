import { Getters, TitanGame } from "./game"
import { PlayerId } from "./player"
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

/**
 * A getter that depends on another (e.g. getMandatoryMoves needs pathsForHex) reads it off
 * the Getters object handed to it rather than recomputing it. This mirrors that wiring without
 * a store: each property recomputes from current game state on every access, which behaves the
 * same as the store's cached computeds for the synchronous scenarios below.
 */
export function createGetters(game: TitanGame): Getters {
  const getters = {} as Getters
  const lazy = <K extends keyof Getters>(key: K, compute: () => Getters[K]): void => {
    Object.defineProperty(getters, key, { get: compute, enumerable: true, configurable: true })
  }
  lazy("round", () => game.getRound())
  lazy("firstRound", () => game.getFirstRound())
  lazy("players", () => game.getPlayers())
  lazy("playerById", () => (id: PlayerId) => game.getPlayerById(id))
  lazy("stacksForPlayer", () => (owner: PlayerId) => game.getStacksForPlayer(owner))
  lazy("stacksForHex", () => (hex: number) => game.getStacksForHex(hex))
  lazy("activePlayer", () => game.getActivePlayer())
  lazy("activePlayerId", () => game.getActivePlayerId())
  lazy("activeStacks", () => game.getActiveStacks())
  lazy("nextMarker", () => game.getNextMarker())
  lazy("pathsForHex", () => (hex: number) => game.getPathsForHex(getters, hex))
  lazy("mandatoryMoves", () => game.getMandatoryMoves(getters))
  lazy("mayProceed", () => game.getMayProceed(getters))
  lazy("mulliganAvailable", () => game.getMulliganAvailable())
  lazy("engagedStacks", () => game.getEngagedStacks(getters))
  return getters
}
