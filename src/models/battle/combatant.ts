import { CREATURE_DATA, CreatureType } from "../creature"
import { PlayerId } from "../player"

export interface IBattleCreature {
  readonly type: CreatureType
  readonly player: PlayerId
  readonly playerScore: number
  hex: number
  wounds?: number
  initialHex?: number
  hasStruck?: boolean
}

// The interface/class pair is merged so the class type picks up these members,
// which are actually assigned at runtime via Object.assign in the constructor below.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface BattleCreature extends IBattleCreature {
  wounds: number
  initialHex: number
  hasStruck: boolean
}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class BattleCreature {
  constructor(props: IBattleCreature) {
    Object.assign(this, {
      ...props,
      wounds: props.wounds ?? 0,
      initialHex: props.initialHex ?? props.hex,
      hasStruck: props.hasStruck ?? false
    })
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

  wound(amount: number): void {
    this.wounds += amount
  }

  performStrike(): void {
    this.hasStruck = true
  }

  phaseEnterMove(): void {
    this.initialHex = this.hex
  }

  phaseExitMove(): void {
    if (this.hex >= 36) {
      this.hex = 0
    }
  }

  phaseEnterStrike(): void {
    this.hasStruck = false
  }

  phaseExitStrikeback(): void {
    if (this.getRemainingHp() <= 0) {
      this.hex = 0
    }
  }
}
