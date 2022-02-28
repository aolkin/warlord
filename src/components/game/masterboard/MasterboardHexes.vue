<template>
  <g class="masterboard">
    <g class="hexes">
      <MasterboardHex
        v-for="id in hexes"
        :key="id"
        :hex="board.getHex(id)"
        @click="canFreeMove && move({ stack: selectedStack, hex: id })"
      />
    </g>
    <MasterboardEdges />
  </g>
</template>
<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapActions, mapGetters } from "vuex"
import board, { Masterboard } from "~/models/masterboard"
import MasterboardEdges from "./MasterboardEdges.vue"
import MasterboardHex from "./MasterboardHex.vue"

export default defineComponent({
  name: "MasterboardHexes",
  components: { MasterboardHex, MasterboardEdges },
  props: {
    canFreeMove: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  computed: {
    ...mapGetters("ui/selections", ["selectedStack"]),
    board(): Masterboard {
      return board
    },
    hexes(): number[] {
      return this.board.getHexIds()
    }
  },
  methods: {
    ...mapActions("game", ["move"])
  }
})
</script>
