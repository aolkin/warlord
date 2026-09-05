import { range } from "lodash-es"
import { assert } from "@/utils/assert"
import { HexEdge } from "@/models/masterboard"
import { StackRef } from "@/models/stack"
import { Battle, BattleCreature, CreatureRef, RangestrikeTarget, StagedMoves as BattleStagedMoves } from "./battle"
import { MasterboardPhase, MusterPayload, StackSplit, StagedMoves, TitanGame } from "./game"
import { defaultRandom, Random } from "./random"

export interface MovePayload {
  stack: StackRef
  hex: number
  edge?: HexEdge
}

export interface BattleMovePayload {
  creature: CreatureRef
  hex: number
}

export interface AttackRequest {
  attacker: CreatureRef
  target: CreatureRef
  optionalToHit?: number
}

export interface RangestrikeRequest {
  attacker: CreatureRef
  target: Omit<RangestrikeTarget, "creature"> & { creature: CreatureRef }
}

export type GameAction =
  | { type: "masterboard/finalizeSplits"; payload: StackSplit[] }
  | { type: "masterboard/takeMulligan" }
  | { type: "masterboard/finalizeMoves"; payload: MovePayload[] }
  | { type: "masterboard/initiateBattle"; payload: StackRef }
  | { type: "masterboard/finalizeMusters"; payload: MusterPayload[] }
  | { type: "battle/finalizeMoves"; payload: BattleMovePayload[] }
  | { type: "battle/endStrikes" }
  | { type: "battle/attackCreature"; payload: AttackRequest }
  | { type: "battle/rangestrikeCreature"; payload: RangestrikeRequest }
  | { type: "battle/commitCarryover"; payload: CreatureRef[] }

export function dispatch(game: TitanGame, action: GameAction, random: Random = defaultRandom): void {
  switch (action.type) {
    case "masterboard/finalizeSplits":
      TitanGame.finalizeSplits(game, action.payload, random)
      break
    case "masterboard/takeMulligan":
      TitanGame.takeMulligan(game, random)
      break
    case "masterboard/finalizeMoves":
      TitanGame.finalizeMoves(game, toStagedMoves(action.payload))
      break
    case "masterboard/initiateBattle":
      assertPhase(game, MasterboardPhase.BATTLE)
      TitanGame.initiateBattle(game, action.payload)
      break
    case "masterboard/finalizeMusters":
      TitanGame.finalizeMusters(game, action.payload)
      break
    case "battle/finalizeMoves":
      Battle.finalizeMoves(requireActiveBattle(game), toBattleStagedMoves(action.payload))
      break
    case "battle/endStrikes":
      Battle.nextPhase(requireActiveBattle(game))
      break
    case "battle/attackCreature": {
      const battle = requireActiveBattle(game)
      const attacker = requireCreature(battle, action.payload.attacker)
      const target = requireCreature(battle, action.payload.target)
      const rolls = rollDice(random, Battle.getAdjustedStrike(battle, attacker, target).dice)
      Battle.attackCreature(battle, { ...action.payload, rolls })
      break
    }
    case "battle/rangestrikeCreature": {
      const battle = requireActiveBattle(game)
      const attacker = requireCreature(battle, action.payload.attacker)
      const target = requireCreature(battle, action.payload.target.creature)
      const strike = Battle.getRangestrike(attacker, { ...action.payload.target, creature: target })
      Battle.rangestrikeCreature(battle, { ...action.payload, rolls: rollDice(random, strike.dice) })
      break
    }
    case "battle/commitCarryover": {
      const battle = requireActiveBattle(game)
      action.payload.forEach(target => Battle.assignCarryover(battle, target))
      Battle.skipCarryover(battle)
      break
    }
    default:
      throw new Error(`Unhandled action: ${JSON.stringify(action satisfies never)}`)
  }
}

function toStagedMoves(payload: MovePayload[]): StagedMoves {
  return new Map(payload.map(({ stack, hex, edge }) => [stack, { hex, edge }]))
}

function toBattleStagedMoves(payload: BattleMovePayload[]): BattleStagedMoves {
  return new Map(payload.map(({ creature, hex }) => [creature, hex]))
}

function assertPhase(game: TitanGame, phase: MasterboardPhase): void {
  assert(game.activePhase === phase, `Action requires the ${MasterboardPhase[phase]} phase`)
}

function requireActiveBattle(game: TitanGame): Battle {
  assert(game.activeBattle !== undefined, "No active battle")
  return game.activeBattle
}

function requireCreature(battle: Battle, id: CreatureRef): BattleCreature {
  const creature = battle.creatures.find(candidate => candidate.id === id)
  assert(creature !== undefined, `No creature with id ${id}`)
  return creature
}

function rollDice(random: Random, count: number): number[] {
  return range(count).map(() => random.die())
}
