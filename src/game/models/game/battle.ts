import { assert } from "@/utils/assert"
import { Battle, BATTLE_PHASE_TYPES, BattleCreature, BattlePhaseType, BattleSide, RangestrikeTarget, nextPhase, performAttack, wound } from "../battle"
import masterboard from "../masterboard"
import { PlayerId } from "../player"
import { Stack, StackRef } from "../stack"
import type { TitanGame } from "../game"

export interface BattleMovePayload { creature: BattleCreature["id"], hex: number }
interface IStrikePayload { attacker: BattleCreature["id"], rolls: number[] }
export interface AttackPayload extends IStrikePayload { target: BattleCreature["id"], optionalToHit?: number }
export interface RangestrikePayload extends IStrikePayload {
  target: Omit<RangestrikeTarget, "creature"> & { creature: BattleCreature["id"] }
}

function toBattleSide(stack: Stack, score: number): BattleSide {
  return { player: stack.owner, score, creatures: stack.creatures }
}

export interface GameBattle {
  getBattleActivePlayer(): PlayerId | undefined
  getBattlePhaseType(): BattlePhaseType | undefined
  getBattleMoves(creature: BattleCreature): Set<number>
  getBattleEngagements(creature: BattleCreature): BattleCreature[]
  getBattleCarryoverTargets(): BattleCreature[] | undefined
  getBattleRangestrikeTargets(creature: BattleCreature): RangestrikeTarget[]
  initiateBattle(attacking: StackRef): Promise<void>
  moveCreature(payload: BattleMovePayload): Promise<void>
  nextBattlePhase(): Promise<void>
  attackCreature(payload: AttackPayload): Promise<void>
  rangestrikeCreature(payload: RangestrikePayload): Promise<void>
  assignCarryover(target: BattleCreature["id"]): Promise<void>
  skipCarryover(): Promise<void>
}

export const gameBattle: GameBattle & ThisType<TitanGame> = {
  getBattleActivePlayer(): PlayerId | undefined {
    return this.activeBattle?.getActivePlayer()
  },

  getBattlePhaseType(): BattlePhaseType | undefined {
    return this.activeBattle === undefined ? undefined : BATTLE_PHASE_TYPES[this.activeBattle.phase]
  },

  getBattleMoves(creature: BattleCreature): Set<number> {
    return this.activeBattle === undefined ? new Set<number>() : this.activeBattle.movementFor(creature)
  },

  getBattleEngagements(creature: BattleCreature): BattleCreature[] {
    return this.activeBattle === undefined ? [] : this.activeBattle.engagedWith(creature)
  },

  getBattleCarryoverTargets(): BattleCreature[] | undefined {
    return this.activeBattle?.carryoverTargets()
  },

  getBattleRangestrikeTargets(creature: BattleCreature): RangestrikeTarget[] {
    return this.activeBattle === undefined ? [] : this.activeBattle.rangestrikeTargets(creature)
  },

  async initiateBattle(attackingRef: StackRef): Promise<void> {
    const attacking = this.stacks.find(stack => stack.id === attackingRef)
    assert(attacking !== undefined, `No stack with id ${attackingRef}`)
    const activePlayerId = this.getActivePlayerId()
    const defending = this.getStacksForHex(attacking.hex)
      .find(stack => stack.owner !== activePlayerId) as Stack
    assert(defending !== undefined,
      `No engagement present on hex ${attacking.hex}!`)
    assert(attacking.attackEdge !== undefined, "Cannot attack without coming from somewhere")
    const terrain = masterboard.getHex(attacking.hex).terrain
    const attackingSide = toBattleSide(attacking, this.getPlayerById(attacking.owner).score)
    const defendingSide = toBattleSide(defending, this.getPlayerById(defending.owner).score)
    this.activeBattle = new Battle(terrain, attacking.attackEdge, attackingSide, defendingSide)
    this.activeBattleHex = attacking.hex
  },

  async moveCreature({ creature: creatureRef, hex }: BattleMovePayload): Promise<void> {
    const creature = this.activeBattle?.creatures.find(c => c.id === creatureRef)
    assert(creature !== undefined, "Unexpected creature")
    assert(this.getBattlePhaseType() === BattlePhaseType.MOVE, "Not in movement phase")
    assert(creature.player === this.getBattleActivePlayer(), "Incorrect player")
    creature.hex = hex
  },

  async nextBattlePhase(): Promise<void> {
    assert(this.activeBattle !== undefined, "No active battle!")
    nextPhase(this.activeBattle)
  },

  async attackCreature({ attacker: attackerRef, target: targetRef, rolls, optionalToHit }: AttackPayload): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    const battle = this.activeBattle
    const attacker = battle.creatures.find(c => c.id === attackerRef)
    assert(attacker !== undefined, "Unexpected attacker")
    const target = battle.creatures.find(c => c.id === targetRef)
    assert(target !== undefined, "Unexpected defender")
    assert(this.getBattlePhaseType() !== BattlePhaseType.MOVE, "Cannot strike in movement phase")
    assert(attacker.player === this.getBattleActivePlayer(), "Incorrect player")
    let toHit = battle.toHitAdjusted(attacker, target)
    if (optionalToHit !== undefined) {
      assert(optionalToHit >= toHit, "Cannot choose a lower to-hit")
      toHit = optionalToHit
    }
    performAttack(battle, attacker, target, rolls, toHit, false)
  },

  async rangestrikeCreature({ attacker: attackerRef, target, rolls }: RangestrikePayload): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    const battle = this.activeBattle
    const attacker = battle.creatures.find(c => c.id === attackerRef)
    assert(attacker !== undefined, "Unexpected attacker")
    const targetCreature = battle.creatures.find(c => c.id === target.creature)
    assert(targetCreature !== undefined, "Unexpected defender")
    assert(this.getBattlePhaseType() !== BattlePhaseType.MOVE, "Cannot strike in movement phase")
    assert(attacker.player === this.getBattleActivePlayer(), "Incorrect player")
    const computedStrike = battle.getRangestrike(attacker, { ...target, creature: targetCreature })
    performAttack(battle, attacker, targetCreature, rolls, computedStrike.toHit, true)
  },

  async assignCarryover(targetRef: BattleCreature["id"]): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    const battle = this.activeBattle
    const target = battle.creatures.find(c => c.id === targetRef)
    assert(target !== undefined, "Unexpected target")
    assert(this.getBattlePhaseType() !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    // Using an optional chain prevents typescript from learning that battle.activeStrike is present
    assert(battle.activeStrike !== undefined &&
      battle.activeStrike.canCarryover, "Cannot carryover")
    const hits = Math.min(battle.activeStrike.getCarryoverHits(), target.getRemainingHp())
    battle.activeStrike.targets.push(target.hex)
    battle.activeStrike.targetHits.push(hits)
    wound(target, hits)
  },

  async skipCarryover(): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    if (this.activeBattle.activeStrike === undefined) { throw new Error("Must have an active strike!") }
    assert(this.getBattlePhaseType() !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    this.activeBattle.activeStrike.carryoverSkipped = true
  }
}
