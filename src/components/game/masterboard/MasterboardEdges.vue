<template>
  <g class="edges">
    <HexEdge
      v-for="item in edges"
      :key="item[0].id + '-' + item[1].hexEdge"
      :edge="item[1]"
      :hex="item[0]"
    />
  </g>
  <g v-if="shadows">
    <HexEdge
      v-for="item in edges"
      :key="item[0].id + '-' + item[1].hexEdge"
      :edge="item[1]"
      :hex="item[0]"
      :shadow="true"
    />
  </g>
</template>
<script setup lang="ts">
import { computed } from "vue"
import board, { MasterboardEdge, MasterboardHex, MovementRule } from "~/models/masterboard"
import { usePreferencesStore } from "~/stores/preferences"
import HexEdge from "./HexEdge.vue"

const preferencesStore = usePreferencesStore()

const edges = computed((): [MasterboardHex, MasterboardEdge][] =>
  Array.from(board.hexes.values()).flatMap(
    hex => hex.getEdges().map((edge): [MasterboardHex, MasterboardEdge] => [hex, edge]))
    .filter(([, edge]) => edge.rule !== MovementRule.NONE))

const shadows = computed(() => preferencesStore.fancyGraphics)
</script>
