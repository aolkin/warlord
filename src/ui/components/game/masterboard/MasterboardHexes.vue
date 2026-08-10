<template>
  <g class="masterboard">
    <g class="hexes">
      <MasterboardHex
        v-for="id in hexes"
        :key="id"
        :hex="masterboard.getHex(id)"
        @click="canFreeMove && move(id)"
      />
    </g>
    <MasterboardEdges />
  </g>
</template>
<script setup lang="ts">
import { computed } from "vue"
import masterboard from "@/models/masterboard"
import { useGameStore } from "~/stores/game"
import { useSelectionStore } from "~/stores/ui/selection"
import MasterboardEdges from "./MasterboardEdges.vue"
import MasterboardHex from "./MasterboardHex.vue"

withDefaults(defineProps<{
  canFreeMove?: boolean
}>(), {
  canFreeMove: false
})

const game = useGameStore().game
const selectionStore = useSelectionStore()

const hexes = computed(() => masterboard.getHexIds())

function move(hex: number): void {
  // Ending a move on an already-occupied hex is illegal regardless of the occupant's
  // owner (a Legion may pass through a hex held by another of the mover's own Legions,
  // but not end its move there - see Titan rules 7.1). A foe-occupied hex is instead an
  // engagement, handled by the attack-edge picker on the enemy stack itself, same as
  // normal path-based movement enforces via TitanGame.getPathsForHex.
  if (game.getStacksForHex(hex).length > 0) {
    return
  }
  void game.move({ stack: selectionStore.requireSelectedStack().id, hex })
}
</script>
