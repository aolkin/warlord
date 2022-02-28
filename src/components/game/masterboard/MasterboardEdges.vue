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
<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import board, { Masterboard, MasterboardEdge, MasterboardHex, MovementRule } from "~/models/masterboard"
import HexEdge from "./HexEdge.vue"

export default defineComponent({
  name: "MasterboardEdges",
  components: { HexEdge },
  computed: {
    board(): Masterboard {
      return board
    },
    edges(): [MasterboardHex, MasterboardEdge][] {
      return Array.from(this.board.hexes.values()).flatMap(
        hex => hex.getEdges().map((edge): [MasterboardHex, MasterboardEdge] => [hex, edge]))
        .filter(([, edge]) => edge.rule !== MovementRule.NONE)
    },
    shadows(): boolean {
      return this.$store.state.ui.preferences.fancyGraphics
    }
  }
})
</script>
