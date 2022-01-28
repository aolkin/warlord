import _ from "lodash"
import { assert } from "~/utils/assert"
import { CREATURE_DATA, CreatureType } from "./creature"
import { Player } from "./player"

export class Stack {
  readonly player: Player
  readonly creatures: CreatureType[]
  readonly marker: number
  readonly split: boolean[]

  origin: number
  hex: number

  /**
     * Initialize a stack for a player at the start of the game with a single creature (Titan or Angel)
     * @param player
     * @param start the stack's starting hex
     * @param initial the first creature in the stack
     * @param marker the stack marker to use, must be an integer 0-11 inclusive
     */
  constructor(player: Player, start: number, marker: number, initial?: CreatureType[]) {
    this.player = player
    this.creatures = initial ?? [CreatureType.TITAN, CreatureType.ANGEL,
      CreatureType.CENTAUR, CreatureType.CENTAUR,
      CreatureType.OGRE, CreatureType.OGRE,
      CreatureType.GARGOYLE, CreatureType.GARGOYLE]
    this.split = _.range(8).map(i => false)
    this.hex = start
    this.origin = start
    this.marker = marker
  }

  setPendingSplit(index: number, pending: boolean): void {
    this.split[index] = pending
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

  getCreatureSplit(split: boolean) {
    return this.creatures.filter((_, index) => this.split[index] === split)
  }

  finalizeSplit(marker: number): Stack {
    assert(this.isValidSplit(), "Invalid split")
    assert(marker >= 0, "Invalid marker")
    const creatures = this.getCreatureSplit(true)
    _.remove(this.creatures, (creature, index) => this.split[index])
    this.split.fill(false)
    return new Stack(this.player, this.hex, marker, creatures)
  }

  getValue(): number {
    return _.sum(this.creatures.map(creature => CREATURE_DATA[creature].getValue()))
  }

  muster(creature: CreatureType): void {
    this.creatures.push(creature)
  }
}
