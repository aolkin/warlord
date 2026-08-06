import { Player } from "~/models/player"
import { BaseActionContext } from "../types"
import selections, { Selections } from "./selection"

export interface UiState {
  selections: Selections
  localPlayer: number
}

export default {
  namespaced: true,
  modules: {
    selections
  },
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
    reset({ commit }: BaseActionContext) {
      commit("selections/reset")
    }
  }
}
