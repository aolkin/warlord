import { defineStore } from "pinia"
import { computed, ref, shallowReactive, shallowRef, watch } from "vue"
import { BattleCreature, RangestrikeTarget } from "@/models/battle"
import { Path } from "@/models/game"
import masterboard, { MasterboardHex } from "@/models/masterboard"
import { Stack } from "@/models/stack"
import { useGameStore } from "~/stores/game"

export enum View {
  MASTERBOARD,
  BATTLEBOARD
}

export const useSelectionStore = defineStore("selection", () => {
  const gameStore = useGameStore()

  // Stack/MasterboardHex/BattleCreature instances here always come from the game store's
  // own reactive state, so they're already reactive proxies by the time they reach
  // this store - shallow refs/collections avoid Vue re-wrapping their internals a second time,
  // which for class instances with private fields also trips up TypeScript (Vue's deep
  // UnwrapRef can't reconstruct a private field, so the mapped type stops matching the class).
  const view = ref<View>(View.MASTERBOARD)
  const stack = shallowRef<Stack>()
  const focusedStacks = shallowReactive<Stack[]>([])
  const focusedHexes = shallowReactive<MasterboardHex[]>([])
  const creature = shallowRef<BattleCreature>()
  const focusedBattleHexes = shallowReactive<number[]>([])

  const selectedStack = computed<Stack | undefined>(() => stack.value)
  const focusedStack = computed<Stack | undefined>(() => focusedStacks.length > 0
    ? focusedStacks[focusedStacks.length - 1]
    : stack.value)
  const focusedHex = computed<MasterboardHex | undefined>(() => focusedHexes.length > 0
    ? focusedHexes[focusedHexes.length - 1]
    : undefined)
  const selectedCreature = computed<BattleCreature | undefined>(() => creature.value)
  const focusedBattleHex = computed<number | undefined>(() => focusedBattleHexes.length > 0
    ? focusedBattleHexes[focusedBattleHexes.length - 1]
    : undefined)

  const paths = computed<Path[]>(() => {
    if (stack.value?.hex === undefined || masterboard.getHex(stack.value.hex) === undefined ||
      gameStore.game.activeRoll === undefined) {
      return []
    }
    return gameStore.pathsForHex(stack.value.hex)
  })
  const movementHexes = computed<Set<number>>(() =>
    creature.value === undefined ? new Set<number>() : gameStore.battleMoves(creature.value))
  const engagements = computed<BattleCreature[]>(() =>
    creature.value === undefined ? [] : gameStore.battleEngagements(creature.value))
  const rangestrikes = computed<RangestrikeTarget[]>(() =>
    creature.value === undefined ? [] : gameStore.battleRangestrikeTargets(creature.value))

  function setView(value: View): void {
    view.value = value
  }

  function reset(): void {
    stack.value = undefined
    creature.value = undefined
    focusedStacks.splice(0, focusedStacks.length)
    focusedHexes.splice(0, focusedHexes.length)
    focusedBattleHexes.splice(0, focusedBattleHexes.length)
  }

  function selectStack(selection: Stack): void {
    stack.value = selection
  }

  function deselectStack(): void {
    stack.value = undefined
  }

  function requireSelectedStack(): Stack {
    if (stack.value === undefined) {
      throw new Error("No stack selected")
    }
    return stack.value
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

  watch(() => gameStore.game.activePhase, deselectStack)

  // Only the empty->present transition should navigate to the battle board - subsequent
  // mutations within the same battle (strikes, wounds, etc.) also change activeBattle.
  watch(() => gameStore.game.activeBattle !== undefined, (hasBattle, hadBattle) => {
    if (hasBattle && !hadBattle) {
      setView(View.BATTLEBOARD)
    }
  })

  return {
    view,
    stack,
    focusedStacks,
    focusedHexes,
    creature,
    focusedBattleHexes,
    selectedStack,
    focusedStack,
    focusedHex,
    selectedCreature,
    focusedBattleHex,
    paths,
    movementHexes,
    engagements,
    rangestrikes,
    setView,
    reset,
    selectStack,
    deselectStack,
    requireSelectedStack,
    enterStack,
    leaveStack,
    enterHex,
    leaveHex,
    selectCreature,
    deselectCreature,
    enterBattleHex,
    leaveBattleHex
  }
})
