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
  void game.move({ stack: selectionStore.requireSelectedStack().id, hex })
}
</script>
