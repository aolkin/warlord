import _ from "lodash"
import { assert } from "~/utils/assert"
import { CREATURE_DATA, CreatureType } from "./creature"
import { Player } from "./player"

export class Stack {
  readonly player: Player
  readonly creatures: CreatureType[]
  readonly hex: number
  readonly marker: number

  private splitFrom?: Stack
  private pendingSplit?: Stack

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
    this.hex = start
    assert(marker >= 0 && marker <= 11, "Invalid initial marker")
    this.marker = marker
  }

  /**
     * Removes the specified creatures from the current stack and returns a new stack with the
     * specified marker.
     * @param creatures creature to split off
     * @param marker marker for the new stack
     */
  split(creatures: CreatureType[], marker: number): Stack {
    assert(creatures.length >= 2 && creatures.length <= 5, "Invalid stack split")
    creatures.forEach(type => {
      this.creatures.splice(this.creatures.indexOf(type), 1)
    })
    assert(marker >= 0, "Invalid marker")
    const splitStack = new Stack(this.player, this.hex, marker, creatures)
    splitStack.splitFrom = this
    this.pendingSplit = splitStack
    return splitStack
  }

  finalizeSplit(): void {
    this.splitFrom = undefined
    this.pendingSplit = undefined
  }

  getValue(): number {
    return _.sum(this.creatures.map(creature => CREATURE_DATA[creature].getValue()))
  }

  muster(creature: CreatureType) {
    this.creatures.push(creature)
  }
}
