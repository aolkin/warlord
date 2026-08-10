import { assert } from "@/utils/assert"
import { Battle, BATTLE_PHASE_TYPES, BattleCreature, BattlePhaseType, RangestrikeTarget, nextPhase, performAttack, wound } from "../battle"
import type { TitanGame } from "../game"

export interface BattleMovePayload { creature: BattleCreature["id"], hex: number }
interface IStrikePayload { attacker: BattleCreature["id"], rolls: number[] }
export interface AttackPayload extends IStrikePayload { target: BattleCreature["id"], optionalToHit?: number }
export interface RangestrikePayload extends IStrikePayload {
  target: Omit<RangestrikeTarget, "creature"> & { creature: BattleCreature["id"] }
}

function requireActiveBattle(game: TitanGame): Battle {
  if (game.activeBattle === undefined) { throw new Error("Must be in a battle!") }
  return game.activeBattle
}

function resolveStrikingCreatures(game: TitanGame, attackerId: BattleCreature["id"], targetId: BattleCreature["id"]): { battle: Battle, attackerCreature: BattleCreature, targetCreature: BattleCreature } {
  const battle = requireActiveBattle(game)
  const attackerCreature = battle.creatures.find(c => c.id === attackerId)
  assert(attackerCreature !== undefined, "Unexpected attacker")
  const targetCreature = battle.creatures.find(c => c.id === targetId)
  assert(targetCreature !== undefined, "Unexpected defender")
  assert(BATTLE_PHASE_TYPES[battle.phase] !== BattlePhaseType.MOVE, "Cannot strike in movement phase")
  assert(attackerCreature.player === battle.getActivePlayer(), "Incorrect player")
  return { battle, attackerCreature, targetCreature }
}

export interface GameBattle {
  moveCreature(payload: BattleMovePayload): Promise<void>
  nextBattlePhase(): Promise<void>
  attackCreature(payload: AttackPayload): Promise<void>
  rangestrikeCreature(payload: RangestrikePayload): Promise<void>
  assignCarryover(target: BattleCreature["id"]): Promise<void>
  skipCarryover(): Promise<void>
}

export const gameBattle: GameBattle & ThisType<TitanGame> = {
  async moveCreature(payload: BattleMovePayload): Promise<void> {
    const battle = requireActiveBattle(this)
    const creature = battle.creatures.find(c => c.id === payload.creature)
    assert(creature !== undefined, "Unexpected creature")
    assert(BATTLE_PHASE_TYPES[battle.phase] === BattlePhaseType.MOVE, "Not in movement phase")
    assert(creature.player === battle.getActivePlayer(), "Incorrect player")
    creature.hex = payload.hex
  },

  async nextBattlePhase(): Promise<void> {
    assert(this.activeBattle !== undefined, "No active battle!")
    nextPhase(this.activeBattle)
  },

  async attackCreature({ attacker, target, rolls, optionalToHit }: AttackPayload): Promise<void> {
    const { battle, attackerCreature, targetCreature } = resolveStrikingCreatures(this, attacker, target)
    let toHit = battle.toHitAdjusted(attackerCreature, targetCreature)
    if (optionalToHit !== undefined) {
      assert(optionalToHit >= toHit, "Cannot choose a lower to-hit")
      toHit = optionalToHit
    }
    performAttack(battle, attackerCreature, targetCreature, rolls, toHit, false)
  },

  async rangestrikeCreature({ attacker, target, rolls }: RangestrikePayload): Promise<void> {
    const { battle, attackerCreature, targetCreature } = resolveStrikingCreatures(this, attacker, target.creature)
    const computedStrike = battle.getRangestrike(attackerCreature, { ...target, creature: targetCreature })
    performAttack(battle, attackerCreature, targetCreature, rolls, computedStrike.toHit, true)
  },

  async assignCarryover(target: BattleCreature["id"]): Promise<void> {
    const battle = requireActiveBattle(this)
    const targetCreature = battle.creatures.find(c => c.id === target)
    assert(targetCreature !== undefined, "Unexpected target")
    assert(BATTLE_PHASE_TYPES[battle.phase] !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    // Using an optional chain prevents typescript from learning that battle.activeStrike is present
    assert(battle.activeStrike !== undefined &&
      battle.activeStrike.canCarryover, "Cannot carryover")
    const hits = Math.min(battle.activeStrike.getCarryoverHits(), targetCreature.getRemainingHp())
    battle.activeStrike.targets.push(targetCreature.hex)
    battle.activeStrike.targetHits.push(hits)
    wound(targetCreature, hits)
  },

  async skipCarryover(): Promise<void> {
    const battle = requireActiveBattle(this)
    if (battle.activeStrike === undefined) { throw new Error("Must have an active strike!") }
    assert(BATTLE_PHASE_TYPES[battle.phase] !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    battle.activeStrike.carryoverSkipped = true
  }
}
