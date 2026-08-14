import { CREATURE_DATA, CreatureType } from "../creature"
import { Moveable } from "../moveable"
import { PlayerId } from "../player"

let battleCreatureIdCounter = 0

export interface BattleCreature extends Moveable {
  readonly type: CreatureType
  readonly player: PlayerId
  readonly id: number
  readonly name: string
  readonly strength: number

  wounds: number
  hasStruck: boolean
}

export type CreateBattleCreatureOptions = Pick<BattleCreature, "type" | "player" | "hex"> & { playerScore: number }

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace BattleCreature {
  // Called on hydration so ids assigned to newly-created creatures never collide with
  // ids already present in a restored save.
  export function reserveIdsThrough(maxUsedId: number): void {
    battleCreatureIdCounter = Math.max(battleCreatureIdCounter, maxUsedId + 1)
  }

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
      initialHex: options.hex,
      hasStruck: false
    }
  }
}
