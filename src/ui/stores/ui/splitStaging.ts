import { defineStore } from "pinia"
import { computed, reactive, watch } from "vue"
import { SplitCommit } from "@/models/game"
import { StackRef } from "@/models/stack"
import { useGameStore } from "~/stores/game"

/**
 * Which creatures the player has picked to split off each of their stacks. The pick is
 * reversible until it is submitted, so it never reaches `game`: the whole set is handed to
 * TitanGame.finalizeSplits at once (see proposals/09-mutation-classification.md).
 */
export const useSplitStagingStore = defineStore("splitStaging", () => {
  const gameStore = useGameStore()

  const staged = reactive(new Map<StackRef, number[]>())

  function splittingIndices(stack: StackRef): number[] {
    return staged.get(stack) ?? []
  }

  function toggle(stack: StackRef, index: number): void {
    const indices = splittingIndices(stack)
    staged.set(
      stack,
      indices.includes(index) ? indices.filter(i => i !== index) : [...indices, index].sort((a, b) => a - b),
    )
  }

  const commits = computed((): SplitCommit[] => [...staged].map(([stack, creatures]) => ({ stack, creatures })))

  watch(
    () => gameStore.game.activePhase,
    () => staged.clear(),
  )

  return {
    splittingIndices,
    toggle,
    commits,
  }
})
