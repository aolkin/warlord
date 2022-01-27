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

  getColor(): string {
    switch (this.color) {
      case PlayerColor.RED:
        return "rgb(223,39,31)"
      case PlayerColor.BLUE:
        return "rgb(7,126,198)"
      case PlayerColor.GREEN:
        return "rgb(45,158,84)"
      case PlayerColor.YELLOW:
        return "rgb(223,207,6)"
      case PlayerColor.BLACK:
        return "rgb(31,30,32)"
      case PlayerColor.BROWN:
        return "brown"
    }
  }
}
