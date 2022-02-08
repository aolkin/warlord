import deepFreeze from "deep-freeze"
import _ from "lodash"
import { CreatureType } from "./creature"
import masterboard, { Terrain } from "./masterboard"
import { PlayerId } from "./player"
import { Stack } from "./stack"

export class BattleCreature {
  readonly type: CreatureType
  wounds: number
  hex?: number

  constructor(type: CreatureType) {
    this.type = type
    this.wounds = 0
  }
}

export enum BattlePhase {
  DEFENDER_MOVE,
  DEFENDER_STRIKE,
  ATTACKER_STRIKEBACK,
  ATTACKER_MOVE,
  ATTACKER_STRIKE,
  DEFENDER_STRIKEBACK
}

export class Battle {
  readonly hex: number
  readonly terrain: Terrain
  readonly attacker: PlayerId
  readonly defender: PlayerId
  readonly offense: BattleCreature[]
  readonly defense: BattleCreature[]

  round: number
  phase: BattlePhase

  constructor(hex: number, attacking: Stack, defending: Stack) {
    this.round = 0
    this.phase = BattlePhase.DEFENDER_MOVE
    this.hex = hex
    this.terrain = masterboard.getHex(hex).terrain
    this.attacker = attacking.owner
    this.defender = defending.owner
    this.offense = attacking.creatures.map(type => new BattleCreature(type))
    this.defense = defending.creatures.map(type => new BattleCreature(type))
  }

  nextPhase() {
    if (this.phase === BattlePhase.DEFENDER_STRIKEBACK) {
      this.round += 1
      this.phase = BattlePhase.DEFENDER_MOVE
    } else {
      this.phase += 1
    }
  }
}

export class BattleBoard {
  readonly terrain: Terrain

  constructor(terrain: Terrain) {
    this.terrain = terrain
  }
}

export const BATTLE_BOARDS = deepFreeze(_.filter(Terrain, (i: any) => i instanceof Number)
  .map((terrain: Terrain) => new BattleBoard(terrain)))
