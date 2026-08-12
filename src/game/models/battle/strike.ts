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

export enum BattlePhaseType {
  MOVE,
  STRIKE,
  STRIKEBACK
}

export enum BattlePhase {
  DEFENDER_MOVE,
  DEFENDER_STRIKE,
  ATTACKER_STRIKEBACK,
  ATTACKER_MOVE,
  ATTACKER_STRIKE,
  DEFENDER_STRIKEBACK
}

export const BATTLE_PHASE_TYPES: Record<BattlePhase, BattlePhaseType> = {
  [BattlePhase.DEFENDER_MOVE]: BattlePhaseType.MOVE,
  [BattlePhase.DEFENDER_STRIKE]: BattlePhaseType.STRIKE,
  [BattlePhase.DEFENDER_STRIKEBACK]: BattlePhaseType.STRIKEBACK,
  [BattlePhase.ATTACKER_MOVE]: BattlePhaseType.MOVE,
  [BattlePhase.ATTACKER_STRIKE]: BattlePhaseType.STRIKE,
  [BattlePhase.ATTACKER_STRIKEBACK]: BattlePhaseType.STRIKEBACK
}

export const BATTLE_PHASE_TITLES: Record<BattlePhase, string> = {
  [BattlePhase.DEFENDER_MOVE]: "Defender's Move",
  [BattlePhase.DEFENDER_STRIKE]: "Defender's Strikes",
  [BattlePhase.DEFENDER_STRIKEBACK]: "Defender's Strikebacks",
  [BattlePhase.ATTACKER_MOVE]: "Attacker's Move",
  [BattlePhase.ATTACKER_STRIKE]: "Attacker's Strikes",
  [BattlePhase.ATTACKER_STRIKEBACK]: "Attacker's Strikebacks"
}

export interface ActiveStrike {
  readonly attacker: number
  targets: number[]
  targetHits: number[]
  readonly rolls: number[]
  readonly toHit: number
  readonly totalHits: number
  carryoverSkipped: boolean
  readonly rangestrike: boolean
}

export type CreateActiveStrikeOptions =
  Pick<ActiveStrike, "attacker" | "rolls" | "toHit" | "totalHits" | "rangestrike"> & {
    target: number
    hits: number
  }

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ActiveStrike {
  export function create(options: CreateActiveStrikeOptions): ActiveStrike {
    return {
      attacker: options.attacker,
      targets: [options.target],
      targetHits: [options.hits],
      rolls: options.rolls,
      toHit: options.toHit,
      totalHits: options.totalHits,
      carryoverSkipped: false,
      rangestrike: options.rangestrike
    }
  }

  export function getCarryoverHits(strike: ActiveStrike): number {
    // A Rangestrike can never carry over hits to another target, regardless of overkill (rulebook
    // section 13, Rangestriking). Carrying over is optional per rule 12.4, so declining it also
    // leaves nothing to carry.
    if (strike.rangestrike || strike.carryoverSkipped) {
      return 0
    }
    return strike.totalHits - sum(strike.targetHits)
  }
}
