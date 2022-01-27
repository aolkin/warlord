<template>
  <div>
    <svg
      class="root"
      viewBox="-400 -350 800 700"
      xmlns="http://www.w3.org/2000/svg"
      @click="deselectStack"
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
      <g v-if="shadows">
        <HexEdge
          v-for="item in edges"
          :key="item[0].id + '-' + item[1].hexEdge"
          :edge="item[1]"
          :hex="item[0]"
          :shadow="true"
        />
      </g>
      <g v-if="stacks.length > 0" class="stacks">
        <MasterboardStack v-for="(stack, index) in stacks" :key="index" :stack="stack" />
      </g>
    </svg>
    <TurnStatus />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapGetters, mapMutations } from "vuex"
import MASTERBOARD, { Masterboard, MasterboardEdge, MasterboardHex } from "~/models/masterboard"
import TurnStatus from "../../ui/game/TurnStatus.vue"
import HexEdge from "./HexEdge.vue"
import MasterboardHexComponent from "./MasterboardHex.vue"
import MasterboardStack from "./MasterboardStack.vue"

export default defineComponent({
  name: "Masterboard",
  components: { TurnStatus, MasterboardStack, HexEdge, MasterboardHex: MasterboardHexComponent },
  computed: {
    ...mapGetters("game", ["stacks"]),
    board(): Masterboard {
      return MASTERBOARD
    },
    hexes(): number[] {
      return this.board.getHexIds()
    },
    edges(): [MasterboardHex, MasterboardEdge][] {
      return Array.from(this.board.hexes.values()).flatMap(
        hex => hex.edges.map((edge): [MasterboardHex, MasterboardEdge] => [hex, edge]))
    },
    shadows(): boolean {
      return this.$store.state.ui.preferences.fancyGraphics
    }
  },
  methods: {
    ...mapMutations("ui/selections", ["deselectStack"])
  }
})
</script>

<style lang="sass" scoped>
.root
  background-color: #101010
  max-width: 1600px
  width: 100%
  height: calc(100vh - 30px)
  margin: auto
  display: flex
</style>
