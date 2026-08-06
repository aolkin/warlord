import { CREATURE_DATA, CreatureType } from "../creature"
import { PlayerId } from "../player"

let battleCreatureIdCounter = 0

export interface BattleCreatureInit {
  readonly type: CreatureType
  readonly player: PlayerId
  readonly playerScore: number
  hex: number
  id?: number
  wounds?: number
  initialHex?: number
  hasStruck?: boolean
}

export interface BattleCreature {
  readonly type: CreatureType
  readonly player: PlayerId
  readonly playerScore: number
  readonly id: number
  hex: number
  wounds: number
  initialHex: number
  hasStruck: boolean
}

export function createBattleCreature(props: BattleCreatureInit): BattleCreature {
  return {
    ...props,
    id: props.id ?? battleCreatureIdCounter++,
    wounds: props.wounds ?? 0,
    initialHex: props.initialHex ?? props.hex,
    hasStruck: props.hasStruck ?? false
  }
}

export function creatureName(creature: BattleCreature): string {
  return CREATURE_DATA[creature.type].name
}

export function getStrength(creature: BattleCreature): number {
  return CREATURE_DATA[creature.type].getStrength(creature.playerScore)
}

export function getRemainingHp(creature: BattleCreature): number {
  return getStrength(creature) - creature.wounds
}

export function wound(creature: BattleCreature, amount: number): void {
  creature.wounds += amount
}

export function performStrike(creature: BattleCreature): void {
  creature.hasStruck = true
}

export function phaseEnterMove(creature: BattleCreature): void {
  creature.initialHex = creature.hex
}

export function phaseExitMove(creature: BattleCreature): void {
  if (creature.hex >= 36) {
    creature.hex = 0
  }
}

export function phaseEnterStrike(creature: BattleCreature): void {
  creature.hasStruck = false
}

export function phaseExitStrikeback(creature: BattleCreature): void {
  if (getRemainingHp(creature) <= 0) {
    creature.hex = 0
  }
}
