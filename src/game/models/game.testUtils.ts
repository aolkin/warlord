import { ActionContext, Getters, TitanGame } from "./game"
import { Random } from "./random"

export const noShuffleRandom: Random = { shuffle: collection => [...collection] }

export function newGame(numPlayers = 2): TitanGame {
  return new TitanGame(numPlayers, noShuffleRandom)
}

/**
 * Vuex wires TitanGame's getXxx methods together by handing each one the same live
 * `getters` object, so a getter that depends on another (e.g. getActiveStacks needs
 * activePlayerId) reads it off that object instead of recomputing it itself. This
 * mirrors that wiring without a real store: each property recomputes from current game
 * state on every access, which behaves the same as Vuex's reactive getters for the
 * synchronous scenarios below.
 */
export function createGetters(game: TitanGame): Getters {
  const getters = {} as Getters
  const lazy = <K extends keyof Getters>(key: K, compute: () => Getters[K]): void => {
    Object.defineProperty(getters, key, { get: compute, enumerable: true, configurable: true })
  }
  lazy("round", () => game.getRound())
  lazy("firstRound", () => game.getFirstRound())
  lazy("players", () => game.getPlayers())
  lazy("playerById", () => game.getPlayerById())
  lazy("stacksForPlayer", () => game.getStacksForPlayer())
  lazy("stacksForHex", () => game.getStacksForHex())
  lazy("activePlayer", () => game.getActivePlayer())
  lazy("activePlayerId", () => game.getActivePlayerId(getters))
  lazy("activeStacks", () => game.getActiveStacks(getters))
  lazy("nextMarker", () => game.getNextMarker(getters) as number)
  lazy("pathsForHex", () => game.getPathsForHex(getters))
  lazy("mandatoryMoves", () => game.getMandatoryMoves(getters))
  lazy("mayProceed", () => game.getMayProceed(getters))
  lazy("mulliganAvailable", () => game.getMulliganAvailable(getters))
  lazy("engagedStacks", () => game.getEngagedStacks(getters))
  return getters
}

/**
 * Builds an ActionContext whose commit/dispatch forward to TitanGame's own mFoo/doFoo
 * methods - the same mapping src/game/store/game/index.ts sets up for the real Vuex module
 * (mutation "fooBar" -> method "mFooBar", action "fooBar" -> method "doFooBar").
 */
export function createActionContext(
  game: TitanGame,
  dispatch: ActionContext["dispatch"] = () => {
    throw new Error("dispatch was not expected to be called")
  }
): ActionContext {
  const getters = createGetters(game)
  const commit: ActionContext["commit"] = (name, payload) => {
    const method = `m${name.charAt(0).toUpperCase()}${name.slice(1)}`
    ;(game as unknown as Record<string, (payload?: unknown) => void>)[method](payload)
  }
  // Actions persist as a side effect; persistence itself is a separate concern (see
  // persistence.ts) and not under test here, so stub it out rather than exercising
  // the real localStorage/compression path for every turn/muster action.
  game.persist = async () => undefined
  return { state: game, getters, commit, dispatch }
}
