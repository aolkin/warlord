import { matches } from "lodash-es"
import { assert } from "@/utils/assert"
import { Battle, BATTLE_PHASE_TYPES, BattleCreature, BattlePhaseType, BattleSide, RangestrikeTarget, nextPhase, performAttack, wound } from "../battle"
import { getActivePlayerId, getPlayerById, getStacksForHex } from "../game"
import masterboard from "../masterboard"
import { PlayerId } from "../player"
import { Stack } from "../stack"
import type { TitanGame } from "../game"

export interface BattleMovePayload { creature: BattleCreature, hex: number }
interface BattlePayload { attacking: Stack, defending: Stack }
interface IStrikePayload { attacker: BattleCreature, rolls: number[] }
export interface AttackPayload extends IStrikePayload { target: BattleCreature, optionalToHit?: number }
export interface RangestrikePayload extends IStrikePayload { target: RangestrikeTarget }

function toBattleSide(stack: Stack, score: number): BattleSide {
  return { player: stack.owner, score, creatures: stack.creatures }
}

// Vue's reactive() unwrapping loses Battle's private members at the type level (though not at
// runtime), so a reactive-wrapped Battle fails structural assignability against the full Battle
// type; these getters only need its public read surface, so accept that instead.
type BattleView = Pick<Battle,
  "phase" | "getActivePlayer" | "movementFor" | "engagedWith" | "carryoverTargets" | "rangestrikeTargets">

export interface GameBattle {
  mInitiateBattle(payload: BattlePayload): void
  mNextBattlePhase(): void
  mMoveCreature(payload: BattleMovePayload): void
  mAttackCreature(payload: AttackPayload): void
  mRangestrikeCreature(payload: RangestrikePayload): void
  mAssignCarryover(target: BattleCreature): void
  mSkipCarryover(): void
  doInitiateBattle(attacking: Stack): Promise<void>
  doMoveCreature(payload: BattleMovePayload): Promise<void>
  doNextBattlePhase(): Promise<void>
  doAttackCreature(payload: AttackPayload): Promise<void>
  doRangestrikeCreature(payload: RangestrikePayload): Promise<void>
  doAssignCarryover(payload: BattleCreature): Promise<void>
  doSkipCarryover(): Promise<void>
}

export const gameBattle: GameBattle & ThisType<TitanGame> = {
  mInitiateBattle({ attacking, defending }: BattlePayload): void {
    assert(attacking.attackEdge !== undefined, "Cannot attack without coming from somewhere")
    const terrain = masterboard.getHex(attacking.hex).terrain
    const attackingSide = toBattleSide(attacking, getPlayerById(this.players, attacking.owner).score)
    const defendingSide = toBattleSide(defending, getPlayerById(this.players, defending.owner).score)
    this.activeBattle = new Battle(terrain, attacking.attackEdge, attackingSide, defendingSide)
    this.activeBattleHex = attacking.hex
  },

  mNextBattlePhase(): void {
    assert(this.activeBattle !== undefined, "No active battle!")
    nextPhase(this.activeBattle)
  },

  mMoveCreature({ creature, hex }: BattleMovePayload): void {
    assert(this.activeBattle?.creatures.some(matches(creature)) ?? false, "Unexpected creature")
    creature.hex = hex
  },

  mAttackCreature({ attacker, target, rolls, optionalToHit }: AttackPayload): void {
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

  mRangestrikeCreature({ attacker, target, rolls }: RangestrikePayload): void {
    assert(this.activeBattle?.creatures.some(matches(attacker)) ?? false, "Unexpected attacker")
    assert(this.activeBattle?.creatures.some(matches(target.creature)) ?? false, "Unexpected defender")
    const battle = this.activeBattle!
    const computedStrike = battle.getRangestrike(attacker, target)
    performAttack(battle, attacker, target.creature, rolls, computedStrike.toHit, true)
  },

  mAssignCarryover(target: BattleCreature): void {
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

  mSkipCarryover(): void {
    const activeStrike = this.activeBattle?.activeStrike
    if (activeStrike !== undefined) {
      activeStrike.carryoverSkipped = true
    }
  },

  async doInitiateBattle(attacking: Stack): Promise<void> {
    const activePlayerId = getActivePlayerId(this.players, this.activePlayer)
    const defending = getStacksForHex(this.stacks, attacking.hex)
      .find(stack => stack.owner !== activePlayerId) as Stack
    assert(defending !== undefined,
      `No engagement present on hex ${attacking.hex}!`)
    this.mInitiateBattle({ attacking, defending })
    await this.persist()
  },

  async doMoveCreature(payload: BattleMovePayload): Promise<void> {
    assert(getBattlePhaseType(this.activeBattle) === BattlePhaseType.MOVE, "Not in movement phase")
    assert(payload.creature.player === getBattleActivePlayer(this.activeBattle), "Incorrect player")
    this.mMoveCreature(payload)
    await this.persist()
  },

  async doNextBattlePhase(): Promise<void> {
    this.mNextBattlePhase()
    await this.persist()
  },

  async doAttackCreature(payload: AttackPayload): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    assert(getBattlePhaseType(this.activeBattle) !== BattlePhaseType.MOVE, "Cannot strike in movement phase")
    assert(payload.attacker.player === getBattleActivePlayer(this.activeBattle), "Incorrect player")
    this.mAttackCreature(payload)
    await this.persist()
  },

  async doRangestrikeCreature(payload: RangestrikePayload): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    assert(getBattlePhaseType(this.activeBattle) !== BattlePhaseType.MOVE, "Cannot strike in movement phase")
    assert(payload.attacker.player === getBattleActivePlayer(this.activeBattle), "Incorrect player")
    this.mRangestrikeCreature(payload)
    await this.persist()
  },

  async doAssignCarryover(payload: BattleCreature): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    assert(getBattlePhaseType(this.activeBattle) !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    this.mAssignCarryover(payload)
    await this.persist()
  },

  async doSkipCarryover(): Promise<void> {
    if (this.activeBattle === undefined) { throw new Error("Must be in a battle!") }
    if (this.activeBattle.activeStrike === undefined) { throw new Error("Must have an active strike!") }
    assert(getBattlePhaseType(this.activeBattle) !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    this.mSkipCarryover()
    await this.persist()
  }
}

export function getBattleActivePlayer(activeBattle: BattleView | undefined): PlayerId | undefined {
  return activeBattle?.getActivePlayer()
}

export function getBattlePhaseType(activeBattle: BattleView | undefined): BattlePhaseType | undefined {
  return activeBattle === undefined ? undefined : BATTLE_PHASE_TYPES[activeBattle.phase]
}

export function getBattleMoves(activeBattle: BattleView | undefined, creature: BattleCreature): Set<number> {
  return activeBattle === undefined ? new Set<number>() : activeBattle.movementFor(creature)
}

export function getBattleEngagements(
  activeBattle: BattleView | undefined, creature: BattleCreature
): BattleCreature[] {
  return activeBattle === undefined ? [] : activeBattle.engagedWith(creature)
}

export function getBattleCarryoverTargets(activeBattle: BattleView | undefined): BattleCreature[] | undefined {
  return activeBattle?.carryoverTargets()
}

export function getBattleRangestrikeTargets(
  activeBattle: BattleView | undefined, creature: BattleCreature
): RangestrikeTarget[] {
  return activeBattle === undefined ? [] : activeBattle.rangestrikeTargets(creature)
}
