import { defineStore } from "pinia"
import { computed, ref, shallowReactive, shallowRef } from "vue"
import type { Store } from "vuex"
import { BattleCreature, RangestrikeTarget } from "@/models/battle"
import { Path } from "@/models/game"
import masterboard, { MasterboardHex } from "@/models/masterboard"
import { Stack } from "@/models/stack"

export enum View {
  MASTERBOARD,
  BATTLEBOARD
}

// The "game" module (src/game/store/game) still lives in Vuex and is reflected off TitanGame's
// prototype (see proposals/04-state-management.md), so its state and getters aren't typed
// through Pinia. Importing the Vuex store instance directly here would cycle back through
// store/game (which imports TitanGame, which imports this file for doNextPhase/doInitiateBattle),
// so plugins/vuex.ts hands it to us at runtime via provideVuexStore instead of a static import.
// Vuex also types Store#getters as `any` and doesn't merge module state into Store#state's
// type, so reads of the game module below go through a local cast to the shape TitanGame
// actually exposes at runtime.
let vuexStore: Store<unknown> | undefined

export function provideVuexStore(instance: Store<unknown>): void {
  vuexStore = instance
}

const requireVuexStore = (): Store<unknown> => {
  if (vuexStore === undefined) {
    throw new Error("Vuex store used before provideVuexStore() registered it")
  }
  return vuexStore
}

const activeRoll = (): number | undefined =>
  (requireVuexStore().state as unknown as { game: { activeRoll?: number } }).game.activeRoll
const pathsForHex = (): (hex: number) => Path[] =>
  requireVuexStore().getters["game/pathsForHex"] as (hex: number) => Path[]
const battleMoves = (): (creature: BattleCreature) => Set<number> =>
  requireVuexStore().getters["game/battleMoves"] as (creature: BattleCreature) => Set<number>
const battleEngagements = (): (creature: BattleCreature) => BattleCreature[] =>
  requireVuexStore().getters["game/battleEngagements"] as (creature: BattleCreature) => BattleCreature[]
const battleRangestrikeTargets = (): (creature: BattleCreature) => RangestrikeTarget[] =>
  requireVuexStore().getters["game/battleRangestrikeTargets"] as (creature: BattleCreature) => RangestrikeTarget[]

export const useSelectionStore = defineStore("selection", () => {
  // Stack/MasterboardHex/BattleCreature instances here always come from the "game" module's
  // own (Vuex-)reactive state, so they're already reactive proxies by the time they reach
  // this store - shallow refs/collections avoid Vue re-wrapping their internals a second time,
  // which for class instances with private fields also trips up TypeScript (Vue's deep
  // UnwrapRef can't reconstruct a private field, so the mapped type stops matching the class).
  const view = ref<View>(View.MASTERBOARD)
  const stack = shallowRef<Stack>()
  const focusedStacks = shallowReactive<Stack[]>([])
  const focusedHexes = shallowReactive<MasterboardHex[]>([])
  const creature = shallowRef<BattleCreature>()
  const focusedCreatures = shallowReactive<BattleCreature[]>([])
  const focusedBattleHexes = shallowReactive<number[]>([])

  const selectedStack = computed<Stack | undefined>(() => stack.value)
  const focusedStack = computed<Stack | undefined>(() => focusedStacks.length > 0
    ? focusedStacks[focusedStacks.length - 1]
    : stack.value)
  const focusedHex = computed<MasterboardHex | undefined>(() => focusedHexes.length > 0
    ? focusedHexes[focusedHexes.length - 1]
    : undefined)
  const selectedCreature = computed<BattleCreature | undefined>(() => creature.value)
  const focusedCreature = computed<BattleCreature | undefined>(() => focusedCreatures.length > 0
    ? focusedCreatures[focusedCreatures.length - 1]
    : creature.value)
  const focusedBattleHex = computed<number | undefined>(() => focusedBattleHexes.length > 0
    ? focusedBattleHexes[focusedBattleHexes.length - 1]
    : undefined)

  const paths = computed<Path[]>(() => {
    if (stack.value?.hex === undefined || masterboard.getHex(stack.value.hex) === undefined ||
      activeRoll() === undefined) {
      return []
    }
    return pathsForHex()(stack.value.hex)
  })
  const movementHexes = computed<Set<number>>(() =>
    creature.value === undefined ? new Set<number>() : battleMoves()(creature.value))
  const engagements = computed<BattleCreature[]>(() =>
    creature.value === undefined ? [] : battleEngagements()(creature.value))
  const rangestrikes = computed<RangestrikeTarget[]>(() =>
    creature.value === undefined ? [] : battleRangestrikeTargets()(creature.value))

  function setView(value: View): void {
    view.value = value
  }

  function reset(): void {
    stack.value = undefined
    creature.value = undefined
    focusedStacks.splice(0, focusedStacks.length)
    focusedHexes.splice(0, focusedHexes.length)
    focusedCreatures.splice(0, focusedCreatures.length)
    focusedBattleHexes.splice(0, focusedBattleHexes.length)
  }

  function selectStack(selection: Stack): void {
    stack.value = selection
  }

  function deselectStack(): void {
    stack.value = undefined
  }

  function enterStack(entering: Stack): void {
    if (!focusedStacks.includes(entering)) {
      focusedStacks.push(entering)
    }
  }

  function leaveStack(leaving: Stack): void {
    const index = focusedStacks.indexOf(leaving)
    if (index !== -1) {
      focusedStacks.splice(index)
    }
  }

  function enterHex(entering: MasterboardHex): void {
    if (!focusedHexes.includes(entering)) {
      focusedHexes.push(entering)
    }
  }

  function leaveHex(leaving: MasterboardHex): void {
    const index = focusedHexes.indexOf(leaving)
    if (index !== -1) {
      focusedHexes.splice(index)
    }
  }

  function selectCreature(selection: BattleCreature): void {
    if (creature.value === selection) {
      creature.value = undefined
    } else {
      creature.value = selection
    }
  }

  function deselectCreature(): void {
    creature.value = undefined
  }

  function enterCreature(entering: BattleCreature): void {
    if (!focusedCreatures.includes(entering)) {
      focusedCreatures.push(entering)
    }
  }

  function leaveCreature(leaving: BattleCreature): void {
    const index = focusedCreatures.indexOf(leaving)
    if (index !== -1) {
      focusedCreatures.splice(index)
    }
  }

  function enterBattleHex(entering: number): void {
    if (!focusedBattleHexes.includes(entering)) {
      focusedBattleHexes.push(entering)
    }
  }

  function leaveBattleHex(leaving: number): void {
    const index = focusedBattleHexes.indexOf(leaving)
    if (index !== -1) {
      focusedBattleHexes.splice(index)
    }
  }

  return {
    view,
    stack,
    focusedStacks,
    focusedHexes,
    creature,
    focusedCreatures,
    focusedBattleHexes,
    selectedStack,
    focusedStack,
    focusedHex,
    selectedCreature,
    focusedCreature,
    focusedBattleHex,
    paths,
    movementHexes,
    engagements,
    rangestrikes,
    setView,
    reset,
    selectStack,
    deselectStack,
    enterStack,
    leaveStack,
    enterHex,
    leaveHex,
    selectCreature,
    deselectCreature,
    enterCreature,
    leaveCreature,
    enterBattleHex,
    leaveBattleHex
  }
})
