import { defineStore } from "pinia"
import { computed, reactive } from "vue"
import { BattleCreature } from "@/models/battle"
import { Getters, MovePayload, MusterPayload, Path, TitanGame } from "@/models/game"
import { AttackPayload, BattleMovePayload, RangestrikePayload } from "@/models/game/battle"
import { Player, PlayerId } from "@/models/player"
import { Stack } from "@/models/stack"

export const useGameStore = defineStore("game", () => {
  // TitanGame holds both the serializable game state and the rules deriving from it
  // (see proposals/04-state-management.md), so the instance itself is the store's state.
  const game = reactive(TitanGame.hydrate())

  const round = computed(() => game.getRound())
  const firstRound = computed(() => game.getFirstRound())
  const players = computed(() => game.getPlayers())
  const activePlayer = computed(() => game.getActivePlayer())
  const activePlayerId = computed(() => game.getActivePlayerId())
  const activeStacks = computed(() => game.getActiveStacks())
  const nextMarker = computed(() => game.getNextMarker())
  const mandatoryMoves = computed(() => game.getMandatoryMoves(getters))
  const mayProceed = computed(() => game.getMayProceed(getters))
  const mulliganAvailable = computed(() => game.getMulliganAvailable())
  const engagedStacks = computed(() => game.getEngagedStacks(getters))
  const battleActivePlayer = computed(() => game.getBattleActivePlayer())
  const battlePhaseType = computed(() => game.getBattlePhaseType())
  const battleCarryoverTargets = computed(() => game.getBattleCarryoverTargets())

  function playerById(id: PlayerId): Player {
    return game.getPlayerById(id)
  }

  function stacksForPlayer(owner: PlayerId): Stack[] {
    return game.getStacksForPlayer(owner)
  }

  function stacksForHex(hex: number): Stack[] {
    return game.getStacksForHex(hex)
  }

  function pathsForHex(hex: number): Path[] {
    return game.getPathsForHex(getters, hex)
  }

  function battleMoves(creature: BattleCreature): Set<number> {
    return game.getBattleMoves(creature)
  }

  function battleEngagements(creature: BattleCreature): BattleCreature[] {
    return game.getBattleEngagements(creature)
  }

  // A getXxx method that builds on other derived values takes them as a Getters object.
  // reactive() unwraps each computed on access, so those reads go through the cache above;
  // the parameterized entries are plain functions and pass through unchanged.
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
    battleRangestrikeTargets: (creature: BattleCreature) => game.getBattleRangestrikeTargets(creature),
    nextPhase: (): Promise<void> => game.doNextPhase(getters),
    setRoll: (roll?: number): Promise<void> => game.doSetRoll(getters, roll),
    move: (payload: MovePayload): Promise<void> => game.doMove(payload),
    setRecruit: (payload: MusterPayload): Promise<void> => game.doSetRecruit(payload),
    nextBattlePhase: (): Promise<void> => game.doNextBattlePhase(),
    moveCreature: (payload: BattleMovePayload): Promise<void> => game.doMoveCreature(payload),
    attackCreature: (payload: AttackPayload): Promise<void> => game.doAttackCreature(payload),
    rangestrikeCreature: (payload: RangestrikePayload): Promise<void> =>
      game.doRangestrikeCreature(payload),
    assignCarryover: (target: BattleCreature): Promise<void> => game.doAssignCarryover(target),
    skipCarryover: (): Promise<void> => game.doSkipCarryover(),
    persist: (): Promise<string | undefined> => game.persist(),
    restore: (encoded: string): Promise<void> => game.doRestore(encoded),
    rehydrate: (hydration: TitanGame): void => game.mRehydrate(hydration),
    reset: (): void => { Object.assign(game, new TitanGame(2)) }
  }
})
