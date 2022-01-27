import { Player } from "~/models/player"
import preferences, { Preferences } from "./preferences"
import selections, { Selections } from "./selection"

export interface UiState {
  preferences: Preferences
  selections: Selections
  activePlayer: number
}

export default {
  namespaced: true,
  modules: {
    preferences,
    selections
  },
  state: () => ({
    activePlayer: 0
  }),
  getters: {
    activePlayer(state: UiState, getters: any, rootState: any): Player {
      return rootState.game.players[state.activePlayer]
    }
  },
  mutations: {
    setPlayer(state: UiState, player: number) {
      state.activePlayer = player
    }
  }
}
