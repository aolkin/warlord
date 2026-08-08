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

  function deselectStack(): void {
    stack.value = undefined
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
    reset: (): void => {
      stack.value = undefined
      creature.value = undefined
      focusedStacks.splice(0, focusedStacks.length)
      focusedHexes.splice(0, focusedHexes.length)
      focusedCreatures.splice(0, focusedCreatures.length)
      focusedBattleHexes.splice(0, focusedBattleHexes.length)
    },
    selectStack: (selection: Stack): void => {
      stack.value = selection
    },
    deselectStack,
    enterStack: (entering: Stack): void => {
      if (!focusedStacks.includes(entering)) {
        focusedStacks.push(entering)
      }
    },
    leaveStack: (leaving: Stack): void => {
      const index = focusedStacks.indexOf(leaving)
      if (index !== -1) {
        focusedStacks.splice(index)
      }
    },
    enterHex: (entering: MasterboardHex): void => {
      if (!focusedHexes.includes(entering)) {
        focusedHexes.push(entering)
      }
    },
    leaveHex: (leaving: MasterboardHex): void => {
      const index = focusedHexes.indexOf(leaving)
      if (index !== -1) {
        focusedHexes.splice(index)
      }
    },
    selectCreature: (selection: BattleCreature): void => {
      if (creature.value === selection) {
        creature.value = undefined
      } else {
        creature.value = selection
      }
    },
    deselectCreature: (): void => {
      creature.value = undefined
    },
    enterCreature: (entering: BattleCreature): void => {
      if (!focusedCreatures.includes(entering)) {
        focusedCreatures.push(entering)
      }
    },
    leaveCreature: (leaving: BattleCreature): void => {
      const index = focusedCreatures.indexOf(leaving)
      if (index !== -1) {
        focusedCreatures.splice(index)
      }
    },
    enterBattleHex: (entering: number): void => {
      if (!focusedBattleHexes.includes(entering)) {
        focusedBattleHexes.push(entering)
      }
    },
    leaveBattleHex: (leaving: number): void => {
      const index = focusedBattleHexes.indexOf(leaving)
      if (index !== -1) {
        focusedBattleHexes.splice(index)
      }
    }
  }
})
