import { StagedMoves } from "@/models/game"
import { HexEdge } from "@/models/masterboard"
import { Stack, StackRef } from "@/models/stack"
import { defineStore } from "pinia"
import { computed, ref, watch } from "vue"
import { useGameStore } from "~/stores/game"

// A move is reversible until submitted, so it never reaches `game`.
export const useMoveStagingStore = defineStore("moveStaging", () => {
  const gameStore = useGameStore()

  const staged = ref<Map<StackRef, { hex: number; edge?: HexEdge }>>(new Map())

  const moves = computed((): StagedMoves => staged.value)

  function stage(stack: StackRef, hex: number, edge?: HexEdge): void {
    staged.value.set(stack, { hex, edge })
  }

  function unstage(stack: StackRef): void {
    staged.value.delete(stack)
  }

  function hexOf(stack: Stack): number {
    return staged.value.get(stack.id)?.hex ?? stack.hex
  }

  function hasMoved(stack: Stack): boolean {
    return staged.value.has(stack.id)
  }

  // A mulligan re-rolls movement, so anything staged under the old roll may no longer be legal.
  watch([() => gameStore.game.activePhase, () => gameStore.game.mulliganTaken], () => staged.value.clear())

  return {
    moves,
    stage,
    unstage,
    hexOf,
    hasMoved,
  }
})
