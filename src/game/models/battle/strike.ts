import { clamp, omit, sum } from "lodash-es"
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

export const combineStrikes = (a: Strike, b: Strike, clampVal?: boolean): Strike => ({
  toHit: clampVal === false ? a.toHit + b.toHit : clamp(a.toHit + b.toHit, 2, 6),
  dice: a.dice + b.dice
})

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

export interface IActiveStrike {
  attacker: number
  targets: number[]
  targetHits: number[]
  rolls: number[]
  toHit: number
  totalHits: number
  carryoverSkipped: boolean
  rangestrike: boolean
}
export interface ActiveStrikeHit {
  target: number
  hits: number
}
type InitialActiveStrike = Omit<IActiveStrike, "targets" | "targetHits" | "carryoverSkipped"> & ActiveStrikeHit

// Merged with the class below so its type picks up IActiveStrike's members,
// which are assigned at runtime via Object.assign in the constructor.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface ActiveStrike extends IActiveStrike {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class ActiveStrike {
  constructor(props: IActiveStrike | InitialActiveStrike) {
    Object.assign(this, "targets" in props ? props : {
      ...omit(props, "target", "hits"),
      targets: [props.target],
      targetHits: [props.hits],
      carryoverSkipped: false
    })
  }

  get target(): number {
    return this.targets[0]
  }

  getCarryoverHits(): number {
    return this.totalHits - sum(this.targetHits)
  }

  get canCarryover(): boolean {
    return !this.rangestrike && !this.carryoverSkipped && this.getCarryoverHits() > 0
  }
}
