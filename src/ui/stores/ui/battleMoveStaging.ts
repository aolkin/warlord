import { defineStore } from "pinia"
import { computed, ref, watch } from "vue"
import { Battle, BattleCreature, BattleMovePayload } from "@/models/battle"
import { useGameStore } from "~/stores/game"

/**
 * Where the player has tentatively moved each creature this battle phase, in the order the
 * moves were made. A move is reversible until it is submitted, so it never reaches `battle`:
 * the whole list is handed to Battle.finalizeMoves at once.
 */
export const useBattleMoveStagingStore = defineStore("battleMoveStaging", () => {
  const gameStore = useGameStore()

  const staged = ref<BattleMovePayload[]>([])

  const moves = computed((): BattleMovePayload[] => staged.value)

  function stage(creature: BattleCreature["id"], hex: number): void {
    staged.value = [...staged.value.filter(move => move.creature !== creature), { creature, hex }]
  }

  function unstage(creature: BattleCreature["id"]): void {
    staged.value = staged.value.filter(move => move.creature !== creature)
  }

  function hexOf(creature: BattleCreature): number {
    return Battle.getStagedHex(creature, staged.value)
  }

  watch([() => gameStore.game.activeBattle, () => gameStore.game.activeBattle?.phase], () => (staged.value = []))

  return {
    moves,
    stage,
    unstage,
    hexOf,
  }
})
