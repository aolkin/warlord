import _ from "lodash"
import { TitanGame } from "~/models/game"

const mapStateMethod = (prefixLen: number) => (name: string) => [_.lowerFirst(name.slice(prefixLen)),
  (state: any, ...args: any[]) => state[name](...args)]
const titanGameMethods = Object.getOwnPropertyNames(TitanGame.prototype)
const titanGameMutations = Object.fromEntries(titanGameMethods
  .filter(name => name.startsWith("m")).map(mapStateMethod(1)))
const titanGameGetters = Object.fromEntries(titanGameMethods
  .filter(name => name.startsWith("get")).map(mapStateMethod(3)))
const mapStateAction = (prefixLen: number) => (name: string) => [_.lowerFirst(name.slice(prefixLen)),
  (context: any, ...args: any[]) => context.state[name](context, ...args)]
const titanGameActions = Object.fromEntries(titanGameMethods
  .filter(name => name.startsWith("do")).map(mapStateAction(2)))

interface actionParam {
  dispatch: (_: string, payload?: any) => void
  commit: (_: string, payload?: any) => void
}

export default {
  namespaced: true,
  state: () => new TitanGame(2),
  getters: {
    ...titanGameGetters
  },
  mutations: {
    ...titanGameMutations,
    reset(state: TitanGame) {
      Object.assign(state, new TitanGame(2))
    }
  },
  actions: {
    ...titanGameActions,
    reset({ commit }: actionParam) {
      commit("reset")
    }
  }
}
