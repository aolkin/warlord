import { Player } from "~/models/player"
import { useSelectionStore } from "~/stores/ui/selection"

export interface UiState {
  localPlayer: number
}

export default {
  namespaced: true,
  state: () => ({
    localPlayer: 0
  }),
  getters: {
    localPlayer(state: UiState, getters: any, rootState: any): Player {
      return rootState.game.players[state.localPlayer]
    }
  },
  mutations: {
    setPlayer(state: UiState, player: number) {
      state.localPlayer = player
    }
  },
  actions: {
    reset() {
      useSelectionStore().reset()
    }
  }
}
