import { CREATURE_DATA, CreatureType } from "../creature"
import { Moveable } from "../moveable"
import { PlayerId } from "../player"

let battleCreatureIdCounter = 0

export interface BattleCreatureProps {
  readonly type: CreatureType
  readonly player: PlayerId
  readonly playerScore: number
  hex: number
}

export class BattleCreature implements Moveable {
  readonly type: CreatureType
  readonly player: PlayerId
  readonly playerScore: number
  readonly id: number

  hex: number
  wounds: number
  initialHex: number
  hasStruck: boolean

  constructor(props: BattleCreatureProps) {
    this.type = props.type
    this.player = props.player
    this.playerScore = props.playerScore
    this.id = battleCreatureIdCounter++
    this.hex = props.hex
    this.wounds = 0
    this.initialHex = props.hex
    this.hasStruck = false
  }

  name(): string {
    return CREATURE_DATA[this.type].name
  }

  getStrength(): number {
    return CREATURE_DATA[this.type].getStrength(this.playerScore)
  }

  getRemainingHp(): number {
    return this.getStrength() - this.wounds
  }
}

export function wound(creature: BattleCreature, amount: number): void {
  creature.wounds += amount
}

export function performStrike(creature: BattleCreature): void {
  creature.hasStruck = true
}
