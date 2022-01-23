import { Masterboard } from "~/models/masterboard"

export interface GameState {
  masterboard: Masterboard
}

export default {
  namespaced: true,
  state: () => ({
    masterboard: new Masterboard()
  })
}
