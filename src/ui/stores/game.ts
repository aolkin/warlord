import { defineStore } from "pinia"
import { computed, reactive } from "vue"
import { BattleCreature } from "@/models/battle"
import {
  getActivePlayer, getActivePlayerId, getActiveStacks, getEngagedStacks, getFirstRound, getMandatoryMoves,
  getMayProceed, getMulliganAvailable, getPathsForHex, getPlayerById, getPlayers, getRound, getStacksForHex,
  getStacksForPlayer, MovePayload, MusterPayload, Path, TitanGame
} from "@/models/game"
import {
  AttackPayload, BattleMovePayload, getBattleActivePlayer, getBattleCarryoverTargets, getBattleEngagements,
  getBattleMoves, getBattlePhaseType, getBattleRangestrikeTargets, RangestrikePayload
} from "@/models/game/battle"
import { Player, PlayerId } from "@/models/player"
import { Stack } from "@/models/stack"

export const useGameStore = defineStore("game", () => {
  // TitanGame holds both the serializable game state and the rules deriving from it
  // (see proposals/04-state-management.md), so the instance itself is the store's state.
  const game = reactive(TitanGame.hydrate())

  const round = computed(() => getRound(game.round))
  const firstRound = computed(() => getFirstRound(game.round))
  const players = computed(() => getPlayers(game.players))
  const activePlayer = computed(() => getActivePlayer(game.players, game.activePlayer))
  const activePlayerId = computed(() => getActivePlayerId(game.players, game.activePlayer))
  const activeStacks = computed(() => getActiveStacks(game))
  const mandatoryMoves = computed(() => getMandatoryMoves(game))
  const mayProceed = computed(() => getMayProceed(game))
  const mulliganAvailable = computed(() => getMulliganAvailable(game))
  const engagedStacks = computed(() => getEngagedStacks(game))
  const battleActivePlayer = computed(() => getBattleActivePlayer(game.activeBattle))
  const battlePhaseType = computed(() => getBattlePhaseType(game.activeBattle))
  const battleCarryoverTargets = computed(() => getBattleCarryoverTargets(game.activeBattle))

  function playerById(id: PlayerId): Player {
    return getPlayerById(game.players, id)
  }

  function stacksForPlayer(owner: PlayerId): Stack[] {
    return getStacksForPlayer(game.stacks, owner)
  }

  function stacksForHex(hex: number): Stack[] {
    return getStacksForHex(game.stacks, hex)
  }

  function pathsForHex(hex: number): Path[] {
    return getPathsForHex(game, hex)
  }

  function battleMoves(creature: BattleCreature): Set<number> {
    return getBattleMoves(game.activeBattle, creature)
  }

  function battleEngagements(creature: BattleCreature): BattleCreature[] {
    return getBattleEngagements(game.activeBattle, creature)
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
    battleRangestrikeTargets: (creature: BattleCreature) => getBattleRangestrikeTargets(game.activeBattle, creature),
    nextPhase: (): Promise<void> => game.doNextPhase(),
    setRoll: (roll?: number): Promise<void> => game.doSetRoll(roll),
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
