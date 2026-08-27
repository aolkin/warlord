import { defineStore } from "pinia"
import { computed, reactive, watch } from "vue"
import { MusterPayload } from "@/models/game"
import { MusterChoice, StackRef } from "@/models/stack"
import { useGameStore } from "~/stores/game"

/** Which recruit for each stack, reversible until submitted to TitanGame.finalizeMusters. */
export const useMusterStagingStore = defineStore("musterStaging", () => {
  const gameStore = useGameStore()

  const staged = reactive(new Map<StackRef, MusterChoice>())

  function recruitFor(stack: StackRef): MusterChoice | undefined {
    return staged.get(stack)
  }

  /** An undefined recruit declines the muster, taking the stack out of the submission. */
  function stage(stack: StackRef, recruit: MusterChoice | undefined): void {
    if (recruit === undefined) {
      staged.delete(stack)
    } else {
      staged.set(stack, recruit)
    }
  }

  const musters = computed((): MusterPayload[] => [...staged].map(([stack, recruit]) => ({ stack, recruit })))

  watch(
    () => gameStore.game.activePhase,
    () => staged.clear(),
  )

  return {
    recruitFor,
    stage,
    musters,
  }
})
