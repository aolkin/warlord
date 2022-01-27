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
    focusedStack(state: Selections): Stack | undefined {
      return (state.focusedStacks.length > 0)
        ? state.focusedStacks[state.focusedStacks.length - 1]
        : state.stack
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
      state.focusedStacks.push(entering)
    },
    leaveStack(state: Selections, leaving: Stack) {
      const index = state.focusedStacks.indexOf(leaving)
      if (index !== -1) {
        state.focusedStacks.splice(index)
      }
    }
  }
}
