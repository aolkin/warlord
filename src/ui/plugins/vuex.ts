import { createStore } from "vuex"
import { TitanGame } from "@/models/game"
import game from "@/store/game"

export interface State {
  game: TitanGame
}

interface LocalState {
  encodedSave?: string
}

const store = createStore({
  state: (): LocalState => ({
    encodedSave: undefined
  }),
  modules: {
    game
  },
  mutations: {
    setEncodedSaveData(state, data?: string) {
      state.encodedSave = data
    }
  }
})

export default store
