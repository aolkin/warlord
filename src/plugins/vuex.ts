import { createStore, Store } from "vuex"
import game, { GameState } from "~/store/game"

interface State {
  game: GameState
}

export default createStore({
  modules: {
    game
  }
})

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $store: Store<State>
  }
}
