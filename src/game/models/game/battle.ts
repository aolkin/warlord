import { matches } from "lodash-es"
import { assert } from "@/utils/assert"
import { Battle, BATTLE_PHASE_TYPES, BattleCreature, BattlePhaseType, BattleSide, RangestrikeTarget, nextPhase, performAttack, wound } from "../battle"
import masterboard from "../masterboard"
import { PlayerId } from "../player"
import { Stack } from "../stack"
import type { TitanGame } from "../game"

export interface BattleMovePayload { creature: BattleCreature, hex: number }
interface IStrikePayload { attacker: BattleCreature, rolls: number[] }
export interface AttackPayload extends IStrikePayload { target: BattleCreature, optionalToHit?: number }
export interface RangestrikePayload extends IStrikePayload { target: RangestrikeTarget }

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
  initiateBattle(attacking: Stack): Promise<void>
  moveCreature(payload: BattleMovePayload): Promise<void>
  nextBattlePhase(): Promise<void>
  attackCreature(payload: AttackPayload): Promise<void>
  rangestrikeCreature(payload: RangestrikePayload): Promise<void>
  assignCarryover(target: BattleCreature): Promise<void>
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

  async initiateBattle(attacking: Stack): Promise<void> {
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

  async moveCreature({ creature, hex }: BattleMovePayload): Promise<void> {
    assert(this.getBattlePhaseType() === BattlePhaseType.MOVE, "Not in movement phase")
    assert(creature.player === this.getBattleActivePlayer(), "Incorrect player")
    assert(this.activeBattle?.creatures.some(matches(creature)) ?? false, "Unexpected creature")
    creature.hex = hex
  },

  async nextBattlePhase(): Promise<void> {
    assert(this.activeBattle !== undefined, "No active battle!")
    nextPhase(this.activeBattle)
  },

  async attackCreature({ attacker, target, rolls, optionalToHit }: AttackPayload): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    assert(this.getBattlePhaseType() !== BattlePhaseType.MOVE, "Cannot strike in movement phase")
    assert(attacker.player === this.getBattleActivePlayer(), "Incorrect player")
    assert(this.activeBattle?.creatures.some(matches(attacker)) ?? false, "Unexpected attacker")
    assert(this.activeBattle?.creatures.some(matches(target)) ?? false, "Unexpected defender")
    const battle = this.activeBattle!
    let toHit = battle.toHitAdjusted(attacker, target)
    if (optionalToHit !== undefined) {
      assert(optionalToHit >= toHit, "Cannot choose a lower to-hit")
      toHit = optionalToHit
    }
    performAttack(battle, attacker, target, rolls, toHit, false)
  },

  async rangestrikeCreature({ attacker, target, rolls }: RangestrikePayload): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    assert(this.getBattlePhaseType() !== BattlePhaseType.MOVE, "Cannot strike in movement phase")
    assert(attacker.player === this.getBattleActivePlayer(), "Incorrect player")
    assert(this.activeBattle?.creatures.some(matches(attacker)) ?? false, "Unexpected attacker")
    assert(this.activeBattle?.creatures.some(matches(target.creature)) ?? false, "Unexpected defender")
    const battle = this.activeBattle!
    const computedStrike = battle.getRangestrike(attacker, target)
    performAttack(battle, attacker, target.creature, rolls, computedStrike.toHit, true)
  },

  async assignCarryover(target: BattleCreature): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    assert(this.getBattlePhaseType() !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    assert(this.activeBattle?.creatures.some(matches(target)) ?? false, "Unexpected target")
    const battle = this.activeBattle!
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
