import { BattleCreature, CreatureRef, StagedMoves } from "@/models/battle"
import { defineStore } from "pinia"
import { computed, ref, watch } from "vue"
import { useGameStore } from "~/stores/game"

export const useBattleMoveStagingStore = defineStore("battleMoveStaging", () => {
  const gameStore = useGameStore()

  const staged = ref<Map<CreatureRef, number>>(new Map())

  const moves = computed((): StagedMoves => staged.value)

  function stage(creature: CreatureRef, hex: number): void {
    staged.value.set(creature, hex)
  }

  function unstage(creature: CreatureRef): void {
    staged.value.delete(creature)
  }

  function hexOf(creature: BattleCreature): number {
    return staged.value.get(creature.id) ?? creature.hex
  }

  watch([() => gameStore.game.activeBattle, () => gameStore.game.activeBattle?.phase], () => staged.value.clear())

  return {
    moves,
    stage,
    unstage,
    hexOf,
  }
})
