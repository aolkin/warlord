import { defineStore } from "pinia"
import { computed, shallowReactive, shallowRef, watch } from "vue"
import { Path } from "@/models/game"
import masterboard, { MasterboardHex } from "@/models/masterboard"
import { Stack } from "@/models/stack"
import { useGameStore } from "~/stores/game"

export const useSelectionStore = defineStore("selection", () => {
  const gameStore = useGameStore()

  // Stack/MasterboardHex instances here always come from the game store's own reactive
  // state, so they're already reactive proxies by the time they reach this store - shallow
  // refs/collections avoid Vue re-wrapping their internals a second time, which for class
  // instances with private fields also trips up TypeScript (Vue's deep UnwrapRef can't
  // reconstruct a private field, so the mapped type stops matching the class).
  const stack = shallowRef<Stack>()
  const focusedHexes = shallowReactive<MasterboardHex[]>([])

  const selectedStack = computed<Stack | undefined>(() => stack.value)
  const focusedHex = computed<MasterboardHex | undefined>(() => focusedHexes.length > 0
    ? focusedHexes[focusedHexes.length - 1]
    : undefined)

  const paths = computed<Path[]>(() => {
    if (stack.value?.hex === undefined || masterboard.getHex(stack.value.hex) === undefined ||
      gameStore.game.activeRoll === undefined) {
      return []
    }
    return gameStore.pathsForHex(stack.value.hex)
  })

  function reset(): void {
    stack.value = undefined
    focusedHexes.splice(0, focusedHexes.length)
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

  watch(() => gameStore.game.activePhase, deselectStack)

  return {
    selectedStack,
    focusedHex,
    paths,
    reset,
    selectStack,
    deselectStack,
    requireSelectedStack,
    enterHex,
    leaveHex
  }
})
