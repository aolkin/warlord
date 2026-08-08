import { upperFirst } from "lodash-es"
import { defineStore } from "pinia"
import { computed, reactive } from "vue"
import { BattleCreature } from "@/models/battle"
import { ActionContext, Getters, MovePayload, MusterPayload, TitanGame } from "@/models/game"
import { AttackPayload, BattleMovePayload, RangestrikePayload } from "@/models/game/battle"
import vuexStore, { State } from "~/plugins/vuex"

export const useGameStore = defineStore("game", () => {
  // TitanGame holds both the serializable game state and the rules deriving from it
  // (see proposals/04-state-management.md), so the instance itself is the store's state.
  // Until the vuex game module goes away it owns that instance; wrapping the very same one
  // keeps reads and writes through either store consistent, since reactive() returns the
  // proxy vuex already created for it.
  const game = reactive((vuexStore.state as unknown as State).game)

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

  const invoke = (name: string, ...args: unknown[]): unknown =>
    (game as unknown as Record<string, (..._: unknown[]) => unknown>)[name](...args)

  // TitanGame's doXxx methods still take the vuex-shaped context the game module hands them,
  // where commit("fooBar") reaches mFooBar and dispatch("fooBar") reaches doFooBar on the
  // instance itself.
  const context: ActionContext = {
    state: game as TitanGame,
    getters,
    commit: (mutation, payload) => { invoke(`m${upperFirst(mutation)}`, payload) },
    dispatch: (action, payload) => { void invoke(`do${upperFirst(action)}`, context, payload) }
  }

  function nextPhase(): Promise<void> {
    return game.doNextPhase(context)
  }

  function setRoll(roll?: number): Promise<void> {
    return game.doSetRoll(context, roll)
  }

  function move(payload: MovePayload): Promise<void> {
    return game.doMove(context, payload)
  }

  function setRecruit(payload: MusterPayload): Promise<void> {
    return game.doSetRecruit(context, payload)
  }

  function nextBattlePhase(): Promise<void> {
    return game.doNextBattlePhase(context)
  }

  function moveCreature(payload: BattleMovePayload): Promise<void> {
    return game.doMoveCreature(context, payload)
  }

  function attackCreature(payload: AttackPayload): Promise<void> {
    return game.doAttackCreature(context, payload)
  }

  function rangestrikeCreature(payload: RangestrikePayload): Promise<void> {
    return game.doRangestrikeCreature(context, payload)
  }

  function assignCarryover(target: BattleCreature): Promise<void> {
    return game.doAssignCarryover(context, target)
  }

  function skipCarryover(): Promise<void> {
    return game.doSkipCarryover(context)
  }

  function persist(): Promise<string | undefined> {
    return game.persist()
  }

  function restore(encoded: string): Promise<void> {
    return game.doRestore(context, encoded)
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
