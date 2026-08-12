import { CREATURE_DATA, CreatureType } from "../creature"
import { Moveable } from "../moveable"
import { PlayerId } from "../player"

let battleCreatureIdCounter = 0

export interface BattleCreature extends Moveable {
  readonly type: CreatureType
  readonly player: PlayerId
  readonly playerScore: number
  readonly id: number
  readonly name: string
  readonly strength: number

  wounds: number
  hasStruck: boolean
}

export type CreateBattleCreatureOptions = Pick<BattleCreature, "type" | "player" | "playerScore" | "hex">

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace BattleCreature {
  export function create(options: CreateBattleCreatureOptions): BattleCreature {
    const data = CREATURE_DATA[options.type]
    return {
      type: options.type,
      player: options.player,
      playerScore: options.playerScore,
      id: battleCreatureIdCounter++,
      name: data.name,
      strength: data.getStrength(options.playerScore),
      hex: options.hex,
      wounds: 0,
      initialHex: options.hex,
      hasStruck: false
    }
  }

  export function wound(creature: BattleCreature, amount: number): void {
    creature.wounds += amount
  }

  export function performStrike(creature: BattleCreature): void {
    creature.hasStruck = true
  }
}
