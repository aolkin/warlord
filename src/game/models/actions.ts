import { range } from "lodash-es"
import { assert } from "@/utils/assert"
import {
  Battle,
  BATTLE_PHASE_TYPES,
  BattleCreature,
  BattleMovePayload,
  BattlePhaseType,
  RangestrikeTarget,
} from "./battle"
import { MasterboardPhase, MovePayload, MusterPayload, SplitCommit, TitanGame } from "./game"
import { defaultRandom, Random } from "./random"
import { StackRef } from "./stack"

export interface AttackRequest {
  attacker: BattleCreature["id"]
  target: BattleCreature["id"]
  /** Rule 12.4: the attacker may announce a higher to-hit than the one terrain and skill give. */
  optionalToHit?: number
}

export interface RangestrikeRequest {
  attacker: BattleCreature["id"]
  target: Omit<RangestrikeTarget, "creature"> & { creature: BattleCreature["id"] }
}

/**
 * Every state change a player can commit, as data. A payload carries ids and the player's
 * choices only; dispatch rolls whatever dice the action occasions.
 */
export type GameAction =
  | { type: "masterboard/finalizeSplits"; payload: SplitCommit[] }
  | { type: "masterboard/rerollMove" }
  | { type: "masterboard/finalizeMoves"; payload: MovePayload[] }
  | { type: "masterboard/initiateBattle"; payload: StackRef }
  | { type: "masterboard/finalizeMusters"; payload: MusterPayload[] }
  | { type: "battle/finalizeMoves"; payload: BattleMovePayload[] }
  | { type: "battle/endStrikes" }
  | { type: "battle/attackCreature"; payload: AttackRequest }
  | { type: "battle/rangestrikeCreature"; payload: RangestrikeRequest }
  | { type: "battle/commitCarryover"; payload: Array<BattleCreature["id"]> }

export function dispatch(game: TitanGame, action: GameAction, random: Random = defaultRandom): void {
  switch (action.type) {
    case "masterboard/finalizeSplits":
      assertPhase(game, MasterboardPhase.SPLIT)
      TitanGame.setSplits(game, action.payload)
      TitanGame.finalizeSplits(game)
      // Rule 6.2: entering the move phase is what occasions a movement roll.
      TitanGame.setRoll(game, random.die())
      break
    case "masterboard/rerollMove":
      assert(game.activeRoll !== undefined, "No roll to take a mulligan on")
      // Clearing the roll is what records the mulligan as taken.
      TitanGame.setRoll(game, undefined)
      TitanGame.setRoll(game, random.die())
      break
    case "masterboard/finalizeMoves":
      TitanGame.finalizeMoves(game, action.payload)
      break
    case "masterboard/initiateBattle":
      assertPhase(game, MasterboardPhase.BATTLE)
      TitanGame.initiateBattle(game, action.payload)
      break
    case "masterboard/finalizeMusters":
      assertPhase(game, MasterboardPhase.MUSTER)
      TitanGame.setMusters(game, action.payload)
      TitanGame.finalizeMusters(game)
      break
    case "battle/finalizeMoves": {
      const battle = requireActiveBattle(game)
      assert(BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.MOVE, "Not in a battle movement phase")
      action.payload.forEach(move => Battle.moveCreature(battle, move))
      Battle.nextPhase(battle)
      break
    }
    case "battle/endStrikes": {
      const battle = requireActiveBattle(game)
      assert(BATTLE_PHASE_TYPES[battle.phase] !== BattlePhaseType.MOVE, "Not in a strike phase")
      Battle.nextPhase(battle)
      break
    }
    case "battle/attackCreature":
      rollAttack(requireActiveBattle(game), action.payload, random)
      break
    case "battle/rangestrikeCreature":
      rollRangestrike(requireActiveBattle(game), action.payload, random)
      break
    case "battle/commitCarryover": {
      const battle = requireActiveBattle(game)
      action.payload.forEach(target => Battle.assignCarryover(battle, target))
      // The submission is the whole carryover decision, so hits it leaves unassigned are forfeit.
      Battle.skipCarryover(battle)
      break
    }
    default:
      // Exhaustiveness check: fails to compile if a GameAction variant is added above
      // without a matching case here.
      throw new Error(`Unhandled action: ${JSON.stringify(action satisfies never)}`)
  }
}

function rollAttack(battle: Battle, request: AttackRequest, random: Random): void {
  const attacker = requireCreature(battle, request.attacker)
  const target = requireCreature(battle, request.target)
  const rolls = rollDice(random, Battle.getAdjustedStrike(battle, attacker, target).dice)
  Battle.attackCreature(battle, { ...request, rolls })
}

function rollRangestrike(battle: Battle, request: RangestrikeRequest, random: Random): void {
  const attacker = requireCreature(battle, request.attacker)
  const target = requireCreature(battle, request.target.creature)
  const strike = Battle.getRangestrike(attacker, { ...request.target, creature: target })
  Battle.rangestrikeCreature(battle, { ...request, rolls: rollDice(random, strike.dice) })
}

function assertPhase(game: TitanGame, phase: MasterboardPhase): void {
  assert(game.activePhase === phase, `Action requires the ${MasterboardPhase[phase]} phase`)
}

function requireActiveBattle(game: TitanGame): Battle {
  assert(game.activeBattle !== undefined, "No active battle")
  return game.activeBattle
}

function requireCreature(battle: Battle, id: BattleCreature["id"]): BattleCreature {
  const creature = battle.creatures.find(candidate => candidate.id === id)
  assert(creature !== undefined, `No creature with id ${id}`)
  return creature
}

function rollDice(random: Random, count: number): number[] {
  return range(count).map(() => random.die())
}
