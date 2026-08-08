declare module "*.css"
declare module "vuetify/styles"

declare module "@3d-dice/dice-box" {
  export default class DiceBox {
    constructor(options?: Record<string, unknown>)
    init(): Promise<void>
    roll(notation: string): void
    onRollComplete: (rollResult: Array<{ rolls: Array<{ value: number }> }>) => void
  }
}
