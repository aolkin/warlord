import { createStore, Store, useStore } from "vuex"
import { TitanGame } from "~/models/game"
import game from "~/store/game"
import ui, { UiState } from "~/store/ui"

export interface State {
  game: TitanGame
  ui: UiState
}

// vuex's useStore() is untyped without an InjectionKey; this project has a single
// global store, so this just re-exposes it with the same typing as $store below.
export const useTypedStore = (): Store<State> => useStore()

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
    reset({ dispatch }) {
      void dispatch("game/reset")
      void dispatch("ui/reset")
    }
  }
})

declare module "vue" {
  interface ComponentCustomProperties {
    $store: Store<State>
  }
}
