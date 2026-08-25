import { defineStore } from "pinia"
import { computed, reactive, watch } from "vue"
import { StackSplit, TitanGame } from "@/models/game"
import { StackRef } from "@/models/stack"
import { useGameStore } from "~/stores/game"

// The pick is reversible until submitted, so it never reaches `game`.
export const useStackSplitsStore = defineStore("stackSplits", () => {
  const gameStore = useGameStore()

  const staged = reactive(new Map<StackRef, Set<number>>())

  function splittingIndices(stack: StackRef): number[] {
    return [...(staged.get(stack) ?? [])]
  }

  function toggle(stack: StackRef, index: number): void {
    const found = gameStore.game.stacks.find(s => s.id === stack)
    if (found === undefined || !TitanGame.isStackActive(gameStore.game, found)) {
      return
    }
    if (!staged.has(stack)) {
      staged.set(stack, new Set())
    }
    const indices = staged.get(stack)!
    if (indices.has(index)) {
      indices.delete(index)
    } else {
      indices.add(index)
    }
  }

  const pendingSplits = computed((): StackSplit[] =>
    [...staged].map(([stack, indices]) => ({ stack, creatures: [...indices] })),
  )

  watch(
    () => gameStore.game.activePhase,
    () => staged.clear(),
  )

  return {
    splittingIndices,
    toggle,
    pendingSplits,
  }
})
