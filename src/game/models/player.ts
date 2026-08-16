export enum PlayerId {
  BLUE,
  GREEN,
  RED,
  YELLOW,
  BLACK,
  BROWN,
}

export interface Player {
  readonly id: PlayerId
  readonly name: string
}
