// Shared by any entity that occupies a hex and remembers the hex it started at, so movement
// can be detected the same way regardless of what kind of entity it is.
export interface Moveable {
  hex: number
  initialHex: number
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Moveable {
  export function hasMoved<T extends Moveable>(entity: T): boolean {
    return entity.hex !== entity.initialHex
  }
}
