import { createStore, Store } from "vuex"
import { TitanGame } from "~/models/game"
import game from "~/store/game"
import ui, { UiState } from "~/store/ui"

interface State {
  game: TitanGame
  ui: UiState
}

export default createStore({
  modules: {
    game, ui
  },
  actions: {
    reset({ commit }) {
      commit("game/reset")
      commit("ui/reset")
    }
  }
})

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $store: Store<State>
  }
}
