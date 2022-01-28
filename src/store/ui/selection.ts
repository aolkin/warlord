import { Path } from "~/models/game"
import masterboard from "~/models/masterboard"
import { Stack } from "~/models/stack"

export interface Selections {
  stack?: Stack
  focusedStacks: Stack[]
}

export default {
  namespaced: true,
  state: () => ({
    focusedStacks: []
  }),
  getters: {
    selectedStack(state: Selections): Stack | undefined {
      return state.stack
    },
    focusedStack(state: Selections): Stack | undefined {
      return (state.focusedStacks.length > 0)
        ? state.focusedStacks[state.focusedStacks.length - 1]
        : state.stack
    },
    paths(state: Selections, getters: any, rootState: any, rootGetters: any): Path[] {
      if (state.stack?.hex === undefined || masterboard.getHex(state.stack.hex) === undefined ||
        rootState.game.activeRoll === undefined) {
        return []
      }
      return rootGetters["game/pathsForHex"](state.stack.hex)
    }
  },
  mutations: {
    reset(state: Selections) {
      state.stack = undefined
      state.focusedStacks = []
    },
    selectStack(state: Selections, selection: Stack) {
      state.stack = selection
    },
    deselectStack(state: Selections) {
      state.stack = undefined
    },
    enterStack(state: Selections, entering: Stack) {
      if (!state.focusedStacks.includes(entering)) {
        state.focusedStacks.push(entering)
      }
    },
    leaveStack(state: Selections, leaving: Stack) {
      const index = state.focusedStacks.indexOf(leaving)
      if (index !== -1) {
        state.focusedStacks.splice(index)
      }
    }
  }
}
