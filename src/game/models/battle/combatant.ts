import { CREATURE_DATA, CreatureType } from "../creature"
import { PlayerId } from "../player"

let battleCreatureIdCounter = 0

export type CreatureRef = number

export interface BattleCreature {
  readonly type: CreatureType
  readonly player: PlayerId
  readonly id: CreatureRef
  readonly name: string
  readonly strength: number

  hex: number
  wounds: number
  hasStruck: boolean
}

export type CreateBattleCreatureOptions = Pick<BattleCreature, "type" | "player" | "hex"> & { playerScore: number }

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace BattleCreature {
  export function create(options: CreateBattleCreatureOptions): BattleCreature {
    const data = CREATURE_DATA[options.type]
    return {
      type: options.type,
      player: options.player,
      id: battleCreatureIdCounter++,
      name: data.name,
      strength: data.getStrength(options.playerScore),
      hex: options.hex,
      wounds: 0,
      hasStruck: false,
    }
  }
}
