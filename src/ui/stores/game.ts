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

  function nextPhase(): Promise<void> {
    return game.doNextPhase(getters)
  }

  function setRoll(roll?: number): Promise<void> {
    return game.doSetRoll(getters, roll)
  }

  function move(payload: MovePayload): Promise<void> {
    return game.doMove(payload)
  }

  function setRecruit(payload: MusterPayload): Promise<void> {
    return game.doSetRecruit(payload)
  }

  function nextBattlePhase(): Promise<void> {
    return game.doNextBattlePhase()
  }

  function moveCreature(payload: BattleMovePayload): Promise<void> {
    return game.doMoveCreature(getters, payload)
  }

  function attackCreature(payload: AttackPayload): Promise<void> {
    return game.doAttackCreature(getters, payload)
  }

  function rangestrikeCreature(payload: RangestrikePayload): Promise<void> {
    return game.doRangestrikeCreature(getters, payload)
  }

  function assignCarryover(target: BattleCreature): Promise<void> {
    return game.doAssignCarryover(getters, target)
  }

  function skipCarryover(): Promise<void> {
    return game.doSkipCarryover(getters)
  }

  function persist(): Promise<string | undefined> {
    return game.persist()
  }

  function restore(encoded: string): Promise<void> {
    return game.doRestore(encoded)
  }

  function rehydrate(hydration: TitanGame): void {
    game.mRehydrate(hydration)
  }

  function reset(): void {
    Object.assign(game, new TitanGame(2))
  }

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
    nextPhase,
    setRoll,
    move,
    setRecruit,
    nextBattlePhase,
    moveCreature,
    attackCreature,
    rangestrikeCreature,
    assignCarryover,
    skipCarryover,
    persist,
    restore,
    rehydrate,
    reset
  }
})
