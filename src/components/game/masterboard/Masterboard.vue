<template>
  <svg
    class="root"
    viewBox="-400 -350 800 700"
    xmlns="http://www.w3.org/2000/svg"
  >
    <MasterboardHex
      v-for="id in hexes"
      :key="id"
      :hex="board.getHex(id)"
    />
    <HexEdge
      v-for="item in edges"
      :key="item[0].id + '-' + item[1].hexEdge"
      :edge="item[1]"
      :hex="item[0]"
    />
  </svg>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { Masterboard, MasterboardEdge, MasterboardHex } from "~/models/masterboard"
import HexEdge from "./HexEdge.vue"
import MasterboardHexComponent from "./MasterboardHex.vue"

export default defineComponent({
  name: "Masterboard",
  components: { HexEdge, MasterboardHex: MasterboardHexComponent },
  computed: {
    board (): Masterboard {
      return this.$store.state.game.masterboard
    },
    hexes (): number[] {
      return this.board.getHexIds()
    },
    edges (): [MasterboardHex, MasterboardEdge][] {
      return Array.from(this.board.hexes.values()).flatMap(
        hex => hex.edges.map((edge): [MasterboardHex, MasterboardEdge] => [hex, edge]))
    }
  }
})
</script>

<style lang="sass" scoped>
.root
  background-color: #101010
</style>
