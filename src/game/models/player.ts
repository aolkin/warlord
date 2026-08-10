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

  constructor(id: PlayerId, name: string) {
    this.id = id
    this.name = name
  }
}
