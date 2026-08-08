import { defineStore } from "pinia"
import { computed, reactive } from "vue"
import { BattleCreature } from "@/models/battle"
import { Getters, MovePayload, MusterPayload, TitanGame } from "@/models/game"
import { AttackPayload, BattleMovePayload, RangestrikePayload } from "@/models/game/battle"

export const useGameStore = defineStore("game", () => {
  // TitanGame holds both the serializable game state and the rules deriving from it
  // (see proposals/04-state-management.md), so the instance itself is the store's state.
  const game = reactive(TitanGame.hydrate())

  const round = computed(() => game.getRound())
  const firstRound = computed(() => game.getFirstRound())
  const players = computed(() => game.getPlayers())
  const playerById = computed(() => game.getPlayerById())
  const stacksForPlayer = computed(() => game.getStacksForPlayer())
  const stacksForHex = computed(() => game.getStacksForHex())
  const activePlayer = computed(() => game.getActivePlayer())
  const activePlayerId = computed(() => game.getActivePlayerId(getters))
  const activeStacks = computed(() => game.getActiveStacks(getters))
  const nextMarker = computed(() => game.getNextMarker(getters))
  const pathsForHex = computed(() => game.getPathsForHex(getters))
  const mandatoryMoves = computed(() => game.getMandatoryMoves(getters))
  const mayProceed = computed(() => game.getMayProceed(getters))
  const mulliganAvailable = computed(() => game.getMulliganAvailable(getters))
  const engagedStacks = computed(() => game.getEngagedStacks(getters))
  const battleActivePlayer = computed(() => game.getBattleActivePlayer())
  const battlePhaseType = computed(() => game.getBattlePhaseType())
  const battleMoves = computed(() => game.getBattleMoves())
  const battleEngagements = computed(() => game.getBattleEngagements())
  const battleCarryoverTargets = computed(() => game.getBattleCarryoverTargets())
  const battleRangestrikeTargets = computed(() => game.getBattleRangestrikeTargets())

  // A getXxx method that builds on other derived values takes them as a Getters object.
  // reactive() unwraps each computed on access, so those reads go through the cache above.
  const getters: Getters = reactive({
    round,
    firstRound,
    players,
    playerById,
    stacksForPlayer,
    stacksForHex,
    activePlayer,
    activePlayerId,
    activeStacks,
    nextMarker,
    pathsForHex,
    mandatoryMoves,
    mayProceed,
    mulliganAvailable,
    engagedStacks,
    battleActivePlayer,
    battlePhaseType,
    battleMoves,
    battleEngagements
  })

  return {
    game,
    round,
    firstRound,
    players,
    playerById,
    stacksForPlayer,
    stacksForHex,
    activePlayer,
    activePlayerId,
    activeStacks,
    pathsForHex,
    mandatoryMoves,
    mayProceed,
    mulliganAvailable,
    engagedStacks,
    battleActivePlayer,
    battlePhaseType,
    battleMoves,
    battleEngagements,
    battleCarryoverTargets,
    battleRangestrikeTargets,
    nextPhase: (): Promise<void> => game.doNextPhase(getters),
    setRoll: (roll?: number): Promise<void> => game.doSetRoll(getters, roll),
    move: (payload: MovePayload): Promise<void> => game.doMove(payload),
    setRecruit: (payload: MusterPayload): Promise<void> => game.doSetRecruit(payload),
    nextBattlePhase: (): Promise<void> => game.doNextBattlePhase(),
    moveCreature: (payload: BattleMovePayload): Promise<void> => game.doMoveCreature(getters, payload),
    attackCreature: (payload: AttackPayload): Promise<void> => game.doAttackCreature(getters, payload),
    rangestrikeCreature: (payload: RangestrikePayload): Promise<void> =>
      game.doRangestrikeCreature(getters, payload),
    assignCarryover: (target: BattleCreature): Promise<void> => game.doAssignCarryover(getters, target),
    skipCarryover: (): Promise<void> => game.doSkipCarryover(getters),
    persist: (): Promise<string | undefined> => game.persist(),
    restore: (encoded: string): Promise<void> => game.doRestore(encoded),
    rehydrate: (hydration: TitanGame): void => game.mRehydrate(hydration),
    reset: (): void => { Object.assign(game, new TitanGame(2)) }
  }
})
