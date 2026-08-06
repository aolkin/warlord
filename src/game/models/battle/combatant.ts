import { CREATURE_DATA, CreatureType } from "../creature"
import { PlayerId } from "../player"

let battleCreatureIdCounter = 0

export interface IBattleCreature {
  readonly type: CreatureType
  readonly player: PlayerId
  readonly playerScore: number
  hex: number
  id?: number
  wounds?: number
  initialHex?: number
  hasStruck?: boolean
}

export class BattleCreature {
  readonly type: CreatureType
  readonly player: PlayerId
  readonly playerScore: number
  readonly id: number

  hex: number
  wounds: number
  initialHex: number
  hasStruck: boolean

  constructor(props: IBattleCreature) {
    this.type = props.type
    this.player = props.player
    this.playerScore = props.playerScore
    this.id = props.id ?? battleCreatureIdCounter++
    this.hex = props.hex
    this.wounds = props.wounds ?? 0
    this.initialHex = props.initialHex ?? props.hex
    this.hasStruck = props.hasStruck ?? false
  }

  get name(): string {
    return CREATURE_DATA[this.type].name
  }

  get strength(): number {
    return CREATURE_DATA[this.type].getStrength(this.playerScore)
  }

  get remainingHp(): number {
    return this.strength - this.wounds
  }
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
  if (creature.remainingHp <= 0) {
    creature.hex = 0
  }
}
