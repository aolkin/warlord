import { CREATURE_DATA, CreatureType } from "../creature"
import { Moveable } from "../moveable"
import { PlayerId } from "../player"

let battleCreatureIdCounter = 0

export interface BattleCreature extends Moveable {
  readonly type: CreatureType
  readonly player: PlayerId
  readonly playerScore: number
  readonly id: number

  wounds: number
  hasStruck: boolean
}

export type CreateBattleCreatureOptions = Pick<BattleCreature, "type" | "player" | "playerScore" | "hex">

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace BattleCreature {
  export function create(options: CreateBattleCreatureOptions): BattleCreature {
    return {
      type: options.type,
      player: options.player,
      playerScore: options.playerScore,
      id: battleCreatureIdCounter++,
      hex: options.hex,
      wounds: 0,
      initialHex: options.hex,
      hasStruck: false
    }
  }

  export function name(creature: BattleCreature): string {
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
}
