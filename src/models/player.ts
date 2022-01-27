import _ from "lodash"
import { Stack } from "./stack"

export enum PlayerColor {
  BLUE,
  GREEN,
  RED,
  YELLOW,
  BLACK,
  BROWN
}

export class Player {
  readonly color: PlayerColor
  readonly markers: number[]
  readonly stacks: Stack[]
  readonly score: number
  name: string

  constructor(color: PlayerColor, hex: number, name: string) {
    this.color = color
    this.name = name
    this.markers = _.range(2, 12)
    this.stacks = [
      new Stack(this, hex, 0)
    ]
    this.score = 0
  }
}
