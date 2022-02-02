import _ from "lodash"
import { assert } from "~/utils/assert"
import { Terrain } from "./masterboard"

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
  readonly initialQuantity: number;
  readonly name: string;
  readonly strength: number;
  readonly skill: number;
  readonly canFly: boolean;
  readonly canRangestrike: boolean
  readonly lord: boolean

  constructor(type: CreatureType, strength: number, skill: number, quantity?: number,
    flying?: boolean, ranged?: boolean, lord?: boolean) {
    this.type = type
    this.initialQuantity = quantity ?? 0
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
  new Creature(CreatureType.BEHEMOTH, 8, 3, 18),
  new Creature(CreatureType.CENTAUR, 3, 4, 25),
  new Creature(CreatureType.COLOSSUS, 10, 4, 10),
  new Creature(CreatureType.CYCLOPS, 9, 2, 28),
  new Creature(CreatureType.DRAGON, 9, 3, 18, true, true),
  new Creature(CreatureType.GARGOYLE, 4, 3, 21, true),
  new Creature(CreatureType.GIANT, 7, 4, 18, false, true),
  new Creature(CreatureType.GORGON, 6, 3, 25, true, true),
  new Creature(CreatureType.GRIFFON, 5, 4, 18, true),
  new Creature(CreatureType.GUARDIAN, 12, 2, 6, true),
  new Creature(CreatureType.HYDRA, 10, 3, 10, false, true),
  new Creature(CreatureType.LION, 5, 3, 28),
  new Creature(CreatureType.MINOTAUR, 4, 4, 21, false, true),
  new Creature(CreatureType.OGRE, 6, 2, 25),
  new Creature(CreatureType.RANGER, 4, 4, 28, true, true),
  new Creature(CreatureType.SERPENT, 18, 2, 10),
  new Creature(CreatureType.TROLL, 8, 2, 28),
  new Creature(CreatureType.UNICORN, 6, 4, 12),
  new Creature(CreatureType.WARBEAR, 6, 3, 21),
  new Creature(CreatureType.WARLOCK, 5, 4, 6, false, true),
  new Creature(CreatureType.WYVERN, 7, 3, 18, true)
]

export const CREATURE_DATA: Record<CreatureType, Creature> = Object.fromEntries(CREATURE_LIST.map(
  item => [item.type, item]
)) as Record<CreatureType, Creature>

export const MUSTER_DATA: Record<Terrain, Array<[number | null, CreatureType]>> = {
  [Terrain.BRUSH]: [
    [null, CreatureType.GARGOYLE],
    [2, CreatureType.CYCLOPS],
    [2, CreatureType.GORGON]
  ],
  [Terrain.JUNGLE]: [
    [null, CreatureType.GARGOYLE],
    [2, CreatureType.CYCLOPS],
    [3, CreatureType.BEHEMOTH],
    [2, CreatureType.SERPENT]
  ],
  [Terrain.PLAINS]: [
    [null, CreatureType.CENTAUR],
    [2, CreatureType.LION],
    [2, CreatureType.RANGER]
  ],
  [Terrain.WOODS]: [
    [null, CreatureType.CENTAUR],
    [3, CreatureType.WARBEAR],
    [2, CreatureType.UNICORN]
  ],
  [Terrain.DESERT]: [
    [null, CreatureType.LION],
    [3, CreatureType.GRIFFON],
    [2, CreatureType.HYDRA]
  ],
  [Terrain.MOUNTAINS]: [
    [null, CreatureType.LION],
    [2, CreatureType.MINOTAUR],
    [2, CreatureType.DRAGON],
    [2, CreatureType.COLOSSUS]
  ],
  [Terrain.MARSH]: [
    [null, CreatureType.OGRE],
    [2, CreatureType.TROLL],
    [2, CreatureType.RANGER]
  ],
  [Terrain.HILLS]: [
    [null, CreatureType.OGRE],
    [3, CreatureType.MINOTAUR],
    [2, CreatureType.UNICORN]
  ],
  [Terrain.SWAMP]: [
    [null, CreatureType.TROLL],
    [3, CreatureType.WYVERN],
    [2, CreatureType.HYDRA]
  ],
  [Terrain.TUNDRA]: [
    [null, CreatureType.TROLL],
    [2, CreatureType.WARBEAR],
    [2, CreatureType.GIANT],
    [2, CreatureType.COLOSSUS]
  ],
  [Terrain.TOWER]: [
    [0, CreatureType.CENTAUR],
    [0, CreatureType.OGRE],
    [0, CreatureType.GARGOYLE]
  ]
}
