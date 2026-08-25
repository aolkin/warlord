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
import { TitanGame } from "@/models/game"
import masterboard from "@/models/masterboard"
import { useGameStore } from "~/stores/game"
import { useMoveStagingStore } from "~/stores/ui/moveStaging"
import { useSelectionStore } from "~/stores/ui/selection"
import MasterboardEdges from "./MasterboardEdges.vue"
import MasterboardHex from "./MasterboardHex.vue"

withDefaults(
  defineProps<{
    canFreeMove?: boolean
  }>(),
  {
    canFreeMove: false,
  },
)

const game = useGameStore().game
const selectionStore = useSelectionStore()
const moveStagingStore = useMoveStagingStore()

const hexes = computed(() => masterboard.getHexIds())

function move(hex: number): void {
  // A foe-occupied hex triggers an engagement via the enemy stack's attack-edge picker,
  // not this click handler.
  if (TitanGame.getStacksForHex(game, hex, moveStagingStore.moves).length > 0) {
    return
  }
  moveStagingStore.stage(selectionStore.requireSelectedStack().id, hex)
}
</script>
