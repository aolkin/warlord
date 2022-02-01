export enum PlayerId {
  BLUE,
  GREEN,
  RED,
  YELLOW,
  BLACK,
  BROWN
}

export class Player {
  readonly id: PlayerId
  readonly name: string
  score: number

  constructor(id: PlayerId, name: string) {
    this.id = id
    this.name = name
    this.score = 0
  }

  addPoints(points: number): void {
    this.score += points
  }
}
