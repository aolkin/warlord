import { createStore, Store } from "vuex"
import game, { GameState } from "~/store/game"
import ui, { UiState } from "~/store/ui"

interface State {
  game: GameState
  ui: UiState
}

export default createStore({
  modules: {
    game, ui
  }
})

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $store: Store<State>
  }
}
