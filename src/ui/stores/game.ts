import { defineStore } from "pinia"
import { computed, reactive, watch } from "vue"
import { TitanGame } from "@/models/game"

const GAME_PERSISTENCE_KEY = "warlord-v1"

export const useGameStore = defineStore("game", () => {
  // TitanGame holds both the serializable game state and the rules deriving from it
  // (see proposals/04-state-management.md), so the instance itself is the store's state.
  const game = reactive(TitanGame.hydrate(localStorage[GAME_PERSISTENCE_KEY]))

  // The engine has no browser dependencies (proposals/05-multiplayer-architecture.md), so
  // persistence lives here instead of at the end of every action. A deep watcher on the
  // reactive game proxy coalesces every synchronous mutation within one action into a single
  // write, and doesn't fire for this initial hydration since that happens before the
  // `reactive()` wrap above.
  watch(game, () => {
    localStorage[GAME_PERSISTENCE_KEY] = JSON.stringify(game)
  }, { deep: true })

  const round = computed(() => game.getRound())
  const firstRound = computed(() => game.getFirstRound())
  const players = computed(() => game.players)
  const activePlayer = computed(() => game.getActivePlayer())
  const activePlayerId = computed(() => game.getActivePlayerId())
  const activeStacks = computed(() => game.getActiveStacks())
  const mandatoryMoves = computed(() => game.getMandatoryMoves())
  const mayProceed = computed(() => game.getMayProceed())
  const mulliganAvailable = computed(() => game.getMulliganAvailable())
  const engagedStacks = computed(() => game.getEngagedStacks())
  const battleActivePlayer = computed(() => game.getBattleActivePlayer())
  const battlePhaseType = computed(() => game.getBattlePhaseType())
  const battleCarryoverTargets = computed(() => game.getBattleCarryoverTargets())

  return {
    game,
    round,
    firstRound,
    players,
    activePlayer,
    activePlayerId,
    activeStacks,
    mandatoryMoves,
    mayProceed,
    mulliganAvailable,
    engagedStacks,
    battleActivePlayer,
    battlePhaseType,
    battleCarryoverTargets,
    reset: (): void => { Object.assign(game, new TitanGame(2)) }
  }
})
