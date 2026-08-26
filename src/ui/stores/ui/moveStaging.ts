import { StagedMoves, TitanGame } from "@/models/game"
import { HexEdge } from "@/models/masterboard"
import { Stack, StackRef } from "@/models/stack"
import { defineStore } from "pinia"
import { computed, shallowRef, watch } from "vue"
import { useGameStore } from "~/stores/game"

// A move is reversible until submitted, so it never reaches `game`.
export const useMoveStagingStore = defineStore("moveStaging", () => {
  const gameStore = useGameStore()

  const staged = shallowRef<StagedMoves>(new Map())

  const moves = computed((): StagedMoves => staged.value)

  const mandatoryMoves = computed(() => TitanGame.getMandatoryMoves(gameStore.game, staged.value))

  function stage(stack: StackRef, hex: number, edge?: HexEdge): void {
    staged.value = new Map(staged.value).set(stack, { hex, edge })
  }

  function unstage(stack: StackRef): void {
    const remaining = new Map(staged.value)
    remaining.delete(stack)
    staged.value = remaining
  }

  function hexOf(stack: Stack): number {
    return staged.value.get(stack.id)?.hex ?? stack.hex
  }

  function hasMoved(stack: Stack): boolean {
    return staged.value.has(stack.id)
  }

  watch(
    () => gameStore.game.activePhase,
    () => (staged.value = new Map()),
  )

  // A mulligan re-rolls movement, so anything staged under the old roll may no longer be legal.
  watch(
    () => gameStore.game.mulliganTaken,
    () => (staged.value = new Map()),
  )

  return {
    moves,
    mandatoryMoves,
    stage,
    unstage,
    hexOf,
    hasMoved,
  }
})
