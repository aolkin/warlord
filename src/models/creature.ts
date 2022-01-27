import _ from "lodash"
import { assert } from "~/utils/assert"

export enum CreatureType {
  ANGEL,
  ARCHANGEL,
  BEHEMOTH,
  CENTAUR,
  COLOSSUS,
  CYCLOPS,
  DRAGON,
  GARGOYLE,
  GIANT,
  GORGON,
  GRIFFON,
  GUARDIAN,
  HYDRA,
  LION,
  MINOTAUR,
  OGRE,
  RANGER,
  SERPENT,
  TITAN,
  TROLL,
  UNICORN,
  WARBEAR,
  WARLOCK,
  WYVERN,
}

export class Creature {
  readonly type: CreatureType;
  readonly initialQuantity?: number;
  readonly name: string;
  readonly strength: number;
  readonly skill: number;
  readonly canFly: boolean;
  readonly canRangestrike: boolean
  readonly lord: boolean

  constructor(type: CreatureType, strength: number, skill: number, quantity?: number,
    flying?: boolean, ranged?: boolean, lord?: boolean) {
    this.type = type
    this.initialQuantity = quantity
    this.name = _.upperFirst(CreatureType[type])
    assert(strength >= 3 && strength <= 18, "Invalid creature strength")
    this.strength = strength
    assert(skill >= 2 && skill <= 4, "Invalid creature skill")
    this.skill = skill
    this.canFly = flying ?? false
    this.canRangestrike = ranged ?? false
    this.lord = lord ?? false
  }

  getValue(): number {
    return this.strength * this.skill
  }
}

export const CREATURE_LIST = [
  new Creature(CreatureType.TITAN, 6, 4, undefined, false, false, true),
  new Creature(CreatureType.ANGEL, 6, 4, undefined, true, false, true),
  new Creature(CreatureType.ARCHANGEL, 9, 4, undefined, true, false, true),
  new Creature(CreatureType.CENTAUR, 3, 4, 25),
  new Creature(CreatureType.OGRE, 6, 2, 25),
  new Creature(CreatureType.GARGOYLE, 4, 3, 21),
  new Creature(CreatureType.BEHEMOTH, 8, 3, 18)
]

export const CREATURE_DATA: Record<CreatureType, Creature> = Object.fromEntries(CREATURE_LIST.map(
  item => [item.type, item]
)) as Record<CreatureType, Creature>
