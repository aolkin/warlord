<template>
  <g class="masterboard">
    <g class="hexes">
      <MasterboardHex
        v-for="id in hexes"
        :key="id"
        :hex="board.getHex(id)"
        @click="canFreeMove && move({ stack: selectionStore.selectedStack, hex: id })"
      />
    </g>
    <MasterboardEdges />
  </g>
</template>
<script setup lang="ts">
import { computed } from "vue"
import { useStore } from "vuex"
import masterboard from "~/models/masterboard"
import { useSelectionStore } from "~/stores/ui/selection"
import MasterboardEdges from "./MasterboardEdges.vue"
import MasterboardHex from "./MasterboardHex.vue"

defineOptions({ name: "MasterboardHexes" })

withDefaults(defineProps<{
  canFreeMove?: boolean
}>(), {
  canFreeMove: false
})

const store = useStore()
const selectionStore = useSelectionStore()

const board = masterboard
const hexes = computed(() => board.getHexIds())

function move(payload: unknown): void {
  void store.dispatch("game/move", payload)
}
</script>
