import { createStore, Store } from "vuex"
import { TitanGame } from "~/models/game"
import game from "~/store/game"
import ui, { UiState } from "~/store/ui"

interface State {
  game: TitanGame
  ui: UiState
}

interface LocalState {
  encodedSave?: string
}

export default createStore({
  state: (): LocalState => ({
    encodedSave: undefined
  }),
  modules: {
    game, ui
  },
  mutations: {
    setEncodedSaveData(state, data?: string) {
      state.encodedSave = data
    }
  },
  actions: {
    reset({ commit, dispatch }) {
      void dispatch("game/reset")
      void dispatch("ui/reset")
    }
  }
})

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $store: Store<State>
  }
}
