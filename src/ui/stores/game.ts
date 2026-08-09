import { defineStore } from "pinia"
import { computed, reactive } from "vue"
import { TitanGame } from "@/models/game"

export const useGameStore = defineStore("game", () => {
  // TitanGame holds both the serializable game state and the rules deriving from it
  // (see proposals/04-state-management.md), so the instance itself is the store's state.
  const game = reactive(TitanGame.hydrate())

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
