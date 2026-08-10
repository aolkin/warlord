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
  assert(game.getBattlePhaseType() !== BattlePhaseType.MOVE, "Cannot strike in movement phase")
  assert(attackerCreature.player === game.getBattleActivePlayer(), "Incorrect player")
  return { battle, attackerCreature, targetCreature }
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

  async initiateBattle(attacking: StackRef): Promise<void> {
    const attackingStack = this.stacks.find(stack => stack.id === attacking)
    assert(attackingStack !== undefined, `No stack with id ${attacking}`)
    const activePlayerId = this.getActivePlayerId()
    const defending = this.getStacksForHex(attackingStack.hex)
      .find(stack => stack.owner !== activePlayerId) as Stack
    assert(defending !== undefined,
      `No engagement present on hex ${attackingStack.hex}!`)
    assert(attackingStack.attackEdge !== undefined, "Cannot attack without coming from somewhere")
    const terrain = masterboard.getHex(attackingStack.hex).terrain
    const attackingSide = toBattleSide(attackingStack, this.getPlayerById(attackingStack.owner).score)
    const defendingSide = toBattleSide(defending, this.getPlayerById(defending.owner).score)
    this.activeBattle = new Battle(terrain, attackingStack.attackEdge, attackingSide, defendingSide)
    this.activeBattleHex = attackingStack.hex
  },

  async moveCreature(payload: BattleMovePayload): Promise<void> {
    const creature = this.activeBattle?.creatures.find(c => c.id === payload.creature)
    assert(creature !== undefined, "Unexpected creature")
    assert(this.getBattlePhaseType() === BattlePhaseType.MOVE, "Not in movement phase")
    assert(creature.player === this.getBattleActivePlayer(), "Incorrect player")
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
    assert(this.getBattlePhaseType() !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
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
    assert(this.getBattlePhaseType() !== BattlePhaseType.MOVE, "Cannot carryover in movement phase")
    battle.activeStrike.carryoverSkipped = true
  }
}
