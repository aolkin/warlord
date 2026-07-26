declare module "*.css"
declare module "vuetify/styles"

// src/main.ts patches every object with a lazily-assigned unique id, used as
// a stable v-for :key for model instances that don't carry their own id.
interface Object {
  __guid?: number
  guid: number
}

declare module "assert" {
  function assert(value: unknown, message?: string | Error): asserts value
  export = assert
}

declare module "@3d-dice/dice-box" {
  export default class DiceBox {
    constructor(selector: string, options?: Record<string, unknown>)
    init(): Promise<void>
    roll(notation: string): void
    onRollComplete: () => void
    rollData: Array<{ rolls: Array<{ result: number }> }>
  }
}
