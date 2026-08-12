import { clamp, sum } from "lodash-es"
import { BattleCreature } from "./combatant"

export interface Strike {
  readonly toHit: number
  readonly dice: number
}

export interface RangestrikeTarget {
  readonly creature: BattleCreature
  readonly adjustment: Strike
  readonly longDistance: boolean
}

export function isRangestrike(arg: BattleCreature | RangestrikeTarget): arg is RangestrikeTarget {
  return "creature" in arg && "adjustment" in arg && "longDistance" in arg
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Strike {
  export function combine(a: Strike, b: Strike, clampVal?: boolean): Strike {
    return {
      toHit: clampVal === false ? a.toHit + b.toHit : clamp(a.toHit + b.toHit, 2, 6),
      dice: a.dice + b.dice
    }
  }
}

interface BaseActiveStrike {
  readonly attacker: number
  readonly target: number
  readonly targetHits: number[]
  readonly rolls: number[]
  readonly toHit: number
  readonly totalHits: number
}

export interface ActiveMeleeStrike extends BaseActiveStrike {
  readonly carryoverTargets: number[]
  readonly carryoverHits: number[]
  carryoverSkipped: boolean
}

export interface ActiveRangestrike extends BaseActiveStrike {
  // Declared as always-absent `never` rather than omitted, so `"carryoverTargets" in strike`
  // narrows the ActiveStrike union in both directions.
  readonly carryoverTargets?: never
}

export type ActiveStrike = ActiveMeleeStrike | ActiveRangestrike

export type CreateActiveStrikeOptions =
  Pick<BaseActiveStrike, "attacker" | "rolls" | "toHit" | "target"> & {
    defenderRemainingHp: number
    rangestrike: boolean
  }

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ActiveStrike {
  export function create(options: CreateActiveStrikeOptions): ActiveStrike {
    const totalHits = options.rolls.filter(roll => roll >= options.toHit).length
    const hits = Math.min(totalHits, options.defenderRemainingHp)
    const base: BaseActiveStrike = {
      attacker: options.attacker,
      target: options.target,
      targetHits: [hits],
      rolls: options.rolls,
      toHit: options.toHit,
      totalHits
    }
    if (options.rangestrike) {
      return base
    }
    return {
      ...base,
      carryoverTargets: [],
      carryoverHits: [],
      carryoverSkipped: false
    }
  }

  export function isRangestrike(strike: ActiveStrike): strike is ActiveRangestrike {
    return !("carryoverTargets" in strike)
  }

  export function getCarryoverHits(strike: ActiveStrike): number {
    if (isRangestrike(strike) || strike.carryoverSkipped) {
      return 0
    }
    return strike.totalHits - sum(strike.targetHits) - sum(strike.carryoverHits)
  }

  export function targets(strike: ActiveStrike): [hex: number, hits: number][] {
    const primary: [hex: number, hits: number][] = [[strike.target, sum(strike.targetHits)]]
    if (isRangestrike(strike)) {
      return primary
    }
    return [
      ...primary,
      ...strike.carryoverTargets.map((hex, index): [hex: number, hits: number] =>
        [hex, strike.carryoverHits[index]])
    ]
  }
}
