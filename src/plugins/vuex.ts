import { createStore, Store, useStore } from "vuex"
import { TitanGame } from "~/models/game"
import game from "~/store/game"
import ui, { UiState } from "~/store/ui"
import { provideVuexStore } from "~/stores/selection"

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

const store = createStore({
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

// The selection store's cross-module reads of "game" (see src/stores/selection.ts) can't
// import this module directly - this module's own module graph already leads back to
// TitanGame (via ~/store/game), which the selection store also imports, so a static import
// here would cycle. Handing over the created instance at runtime breaks that cycle.
provideVuexStore(store)

export default store

declare module "vue" {
  interface ComponentCustomProperties {
    $store: Store<State>
  }
}
