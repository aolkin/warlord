import _ from "lodash"
import { assert } from "~/utils/assert"
import { CREATURE_DATA, CreatureType } from "./creature"
import { PlayerId } from "./player"

export type StackRef = number

export class Stack {
  readonly owner: PlayerId
  readonly creatures: CreatureType[]
  readonly marker: number
  readonly split: boolean[]

  origin: number
  hex: number

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
  }

  numSplitting(): number {
    return _.sum(this.split.map(i => i ? 1 : 0))
  }

  hasMoved(): boolean {
    return this.hex !== this.origin
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
