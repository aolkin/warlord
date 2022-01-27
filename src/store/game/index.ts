import _ from "lodash"
import { TitanGame } from "~/models/game"

const mapStateMethod = (prefixLen: number) => (name: string) => [_.lowerFirst(name.slice(prefixLen)),
  (state: any, ...args: any[]) => state[name](...args)]
const titanGameMethods = Object.getOwnPropertyNames(TitanGame.prototype)
const titanGameMutations = Object.fromEntries(titanGameMethods
  .filter(name => name.startsWith("m")).map(mapStateMethod(1)))
const titanGameGetters = Object.fromEntries(titanGameMethods
  .filter(name => name.startsWith("get")).map(mapStateMethod(3)))

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
  }
}
