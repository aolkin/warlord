import { BattleCreature } from "~/models/battle"
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
  creature?: BattleCreature
  focusedCreatures: BattleCreature[]
  focusedBattleHexes: number[]
}

export default {
  namespaced: true,
  state: () => ({
    view: View.MASTERBOARD,
    focusedStacks: [],
    focusedHexes: [],
    focusedCreatures: [],
    focusedBattleHexes: []
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
    selectedCreature(state: Selections): BattleCreature | undefined {
      return state.creature
    },
    focusedCreature(state: Selections): BattleCreature | undefined {
      return (state.focusedCreatures.length > 0)
        ? state.focusedCreatures[state.focusedCreatures.length - 1]
        : state.creature
    },
    focusedBattleHex(state: Selections): number | undefined {
      return (state.focusedBattleHexes.length > 0)
        ? state.focusedBattleHexes[state.focusedBattleHexes.length - 1]
        : undefined
    },
    paths(state: Selections, getters: any, rootState: any, rootGetters: any): Path[] {
      if (state.stack?.hex === undefined || masterboard.getHex(state.stack.hex) === undefined ||
        rootState.game.activeRoll === undefined) {
        return []
      }
      return rootGetters["game/pathsForHex"](state.stack.hex)
    },
    movementHexes(state: Selections, getters: any, rootState: any, rootGetters: any): Set<number> {
      return state.creature === undefined ? new Set<number>() : rootGetters["game/battleMoves"](state.creature)
    },
    engagements(state: Selections, getters: any, rootState: any, rootGetters: any): BattleCreature[] {
      return state.creature === undefined ? [] : rootGetters["game/battleEngagements"](state.creature)
    },
    rangestrikes(state: Selections, getters: any, rootState: any, rootGetters: any): Array<[BattleCreature, number]> {
      return state.creature === undefined ? [] : rootGetters["game/battleRangestrikeTargets"](state.creature)
    }
  },
  mutations: {
    setView(state: Selections, view: View) {
      state.view = view
    },
    reset(state: Selections) {
      state.stack = undefined
      state.creature = undefined
      state.focusedStacks = []
      state.focusedHexes = []
      state.focusedCreatures = []
      state.focusedBattleHexes = []
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
    },
    selectCreature(state: Selections, selection: BattleCreature) {
      if (state.creature === selection) {
        state.creature = undefined
      } else {
        state.creature = selection
      }
    },
    deselectCreature(state: Selections) {
      state.creature = undefined
    },
    enterCreature(state: Selections, entering: BattleCreature) {
      if (!state.focusedCreatures.includes(entering)) {
        state.focusedCreatures.push(entering)
      }
    },
    leaveCreature(state: Selections, leaving: BattleCreature) {
      const index = state.focusedCreatures.indexOf(leaving)
      if (index !== -1) {
        state.focusedCreatures.splice(index)
      }
    },
    enterBattleHex(state: Selections, entering: number) {
      if (!state.focusedBattleHexes.includes(entering)) {
        state.focusedBattleHexes.push(entering)
      }
    },
    leaveBattleHex(state: Selections, leaving: number) {
      const index = state.focusedBattleHexes.indexOf(leaving)
      if (index !== -1) {
        state.focusedBattleHexes.splice(index)
      }
    }
  }
}
