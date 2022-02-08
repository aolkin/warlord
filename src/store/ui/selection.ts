import { Path } from "~/models/game"
import masterboard, { MasterboardHex } from "~/models/masterboard"
import { Stack } from "~/models/stack"

export enum View {
  MASTERBOARD,
  BATTLEBOARD
}

export interface Selections {
  view: View
  stack?: Stack
  focusedStacks: Stack[]
  focusedHexes: MasterboardHex[]
}

export default {
  namespaced: true,
  state: () => ({
    view: View.MASTERBOARD,
    focusedStacks: [],
    focusedHexes: []
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
    focusedHex(state: Selections): MasterboardHex | undefined {
      return (state.focusedHexes.length > 0)
        ? state.focusedHexes[state.focusedHexes.length - 1]
        : undefined
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
    setView(state: Selections, view: View) {
      state.view = view
    },
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
    },
    enterHex(state: Selections, entering: MasterboardHex) {
      if (!state.focusedHexes.includes(entering)) {
        state.focusedHexes.push(entering)
      }
    },
    leaveHex(state: Selections, leaving: MasterboardHex) {
      const index = state.focusedHexes.indexOf(leaving)
      if (index !== -1) {
        state.focusedHexes.splice(index)
      }
    }
  }
}
