import _ from "lodash"
import { assert } from "~/utils/assert"
import { CREATURE_DATA, CreatureType, MUSTER_DATA } from "./creature"
import { HexEdge, Terrain } from "./masterboard"
import { PlayerId } from "./player"

export type StackRef = number

export type MusterBasis = [CreatureType, number]
export type MusterPossibility = [CreatureType, MusterBasis[]]

export class Stack {
  readonly owner: PlayerId
  readonly creatures: CreatureType[]
  readonly marker: number
  readonly split: boolean[]
  readonly recruits: Record<number, MusterPossibility>

  origin: number
  hex: number
  attackEdge: HexEdge | undefined
  currentMuster: MusterPossibility | undefined

  constructor(owner: PlayerId, start: number, marker: number, initial?: CreatureType[]) {
    this.owner = owner
    this.creatures = initial ?? [CreatureType.TITAN, CreatureType.ANGEL,
      CreatureType.CENTAUR, CreatureType.CENTAUR,
      CreatureType.OGRE, CreatureType.OGRE,
      CreatureType.GARGOYLE, CreatureType.GARGOYLE]
    this.split = _.range(8).map(i => false)
    this.hex = start
    this.origin = start
    this.marker = marker
    this.recruits = {}
  }

  numSplitting(): number {
    return _.sum(this.split.map(i => i ? 1 : 0))
  }

  hasMoved(): boolean {
    return this.hex !== this.origin
  }

  canMuster(): boolean {
    return this.hasMoved() && this.creatures.length < 7
  }

  isValidSplit(firstRound?: boolean): boolean {
    const numSplitting = this.numSplitting()
    if (firstRound ?? false) {
      if (numSplitting !== 4) {
        return false
      }
      const splitLords: number = _.sum(this.creatures.map((creature, index) =>
        this.split[index] && CREATURE_DATA[creature].lord))
      if (splitLords !== 1) {
        return false
      }
    }
    const remaining = this.creatures.length - numSplitting
    return numSplitting === 0 || (numSplitting >= 2 && remaining >= 2)
  }

  getCreaturesSplit(split: boolean): CreatureType[] {
    return this.creatures.filter((_, index) => this.split[index] === split)
  }

  getValue(): number {
    return _.sum(this.creatures.map(creature => CREATURE_DATA[creature].getValue()))
  }

  musterable(terrain: Terrain): MusterPossibility[] {
    const creatureCounts = this.creatures.reduce((acc: Map<CreatureType, number>, creature: CreatureType) =>
      acc.set(creature, (acc.get(creature) ?? 0) + 1), new Map())
    const terrainData = MUSTER_DATA[terrain]
    const possibilities: MusterPossibility[] = []
    if (terrain === Terrain.TOWER) {
      possibilities.push(...terrainData.map(([, creature]) =>
        [creature, [[creature, 0]]] as MusterPossibility))
      const creaturePossibilities: MusterBasis[] = []
      creatureCounts.forEach((count, type) => {
        if (count >= 3) {
          creaturePossibilities.push([type, 3])
        }
      })
      possibilities.push([CreatureType.GUARDIAN, creaturePossibilities])
      possibilities.push([CreatureType.WARLOCK,
        creatureCounts.get(CreatureType.TITAN) !== undefined ? [[CreatureType.TITAN, 1]] : []])
    } else {
      for (let i = 0; i < terrainData.length; ++i) {
        const [req, type] = terrainData[i]
        const creaturePossibilities: MusterBasis[] = []
        if (req !== null) {
          const previousCreature = terrainData[i - 1][1]
          if ((creatureCounts.get(previousCreature) ?? 0) >= req) {
            creaturePossibilities.push([previousCreature, req])
          }
        }
        for (let k = i; k < terrainData.length; ++k) {
          const [, advancedType] = terrainData[k]
          if (creatureCounts.get(advancedType) !== undefined) {
            creaturePossibilities.push([advancedType, 1])
          }
        }
        possibilities.push([type, creaturePossibilities])
      }
    }
    return possibilities
  }

  // MUTATING METHODS - todo, change this

  setPendingSplit(index: number, pending: boolean): void {
    this.split[index] = pending
  }

  finalizeSplit(marker: number): Stack {
    assert(this.isValidSplit(), "Invalid split")
    assert(marker >= 0, "Invalid marker")
    const creatures = this.getCreaturesSplit(true)
    _.remove(this.creatures, (creature, index) => this.split[index])
    this.split.fill(false)
    return new Stack(this.owner, this.hex, marker, creatures)
  }

  muster(creature: CreatureType): void {
    this.creatures.push(creature)
  }
}
