import { Player } from "~/models/player"
import { BaseActionContext } from "../types"
import preferences, { Preferences } from "./preferences"
import selections, { Selections } from "./selection"

export interface UiState {
  preferences: Preferences
  selections: Selections
  localPlayer: number
}

export default {
  namespaced: true,
  modules: {
    preferences,
    selections
  },
  state: () => ({
    localPlayer: 0
  }),
  getters: {
    localPlayer(state: UiState, getters: any, rootState: any, rootGetters: any): Player {
      // return rootGetters["game/playerById"](state.localPlayer)
      return rootState.game.players[state.localPlayer]
    }
  },
  mutations: {
    setPlayer(state: UiState, player: number) {
      state.localPlayer = player
    }
  },
  actions: {
    reset({ commit }: BaseActionContext) {
      commit("selections/reset")
    }
  }
}
