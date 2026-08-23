import { defineStore } from "pinia"
import { computed, reactive, watch } from "vue"
import { SplitCommit, TitanGame } from "@/models/game"
import { StackRef } from "@/models/stack"
import { useGameStore } from "~/stores/game"

// The pick is reversible until submitted, so it never reaches `game`.
export const useSplitStagingStore = defineStore("splitStaging", () => {
  const gameStore = useGameStore()

  const staged = reactive(new Map<StackRef, Set<number>>())

  function splittingIndices(stack: StackRef): number[] {
    return [...(staged.get(stack) ?? [])]
  }

  // A split needs at least 2 creatures remaining and 2 splitting off, so any stack of 2 or
  // fewer can never produce a valid split.
  function isSplittable(stack: StackRef): boolean {
    const found = gameStore.game.stacks.find(s => s.id === stack)
    return (
      found !== undefined &&
      found.owner === gameStore.game.activePlayerId &&
      TitanGame.isSplitPhase(gameStore.game) &&
      found.creatures.length > 2
    )
  }

  function toggle(stack: StackRef, index: number): void {
    if (!isSplittable(stack)) {
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

  const pendingCommits = computed((): SplitCommit[] =>
    [...staged].map(([stack, indices]) => ({ stack, creatures: [...indices] })),
  )

  watch(
    () => gameStore.game.activePhase,
    () => staged.clear(),
  )

  return {
    splittingIndices,
    isSplittable,
    toggle,
    pendingCommits,
  }
})
