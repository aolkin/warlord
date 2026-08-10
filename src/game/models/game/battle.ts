import { assert } from "@/utils/assert"
import { BATTLE_PHASE_TYPES, Battle, BattleCreature, BattlePhaseType, BattleSide, RangestrikeTarget } from "../battle"
import masterboard from "../masterboard"
import { PlayerId } from "../player"
import { Stack } from "../stack"
import type { TitanGame } from "../game"

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
  }
}
