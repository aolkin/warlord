<template>
  <div class="root">
    <svg v-if="activeBattle === undefined" class="no-active-battle" viewBox="-100 -50 200 100">
      <text x="0" y="0">No Active Battle!</text>
    </svg>
    <template v-else>
      <v-card absolute top left class="ma-3">
        <v-card-title>Battle Land: {{ Terrain[terrain] }}</v-card-title>
      </v-card>
      <svg class="board"><!-- terrain --></svg>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapState } from "vuex"
import { Terrain } from "~/models/masterboard"

export default defineComponent({
  name: "BattleBoard",
  data: () => ({
    Terrain
  }),
  computed: {
    ...mapState("game", ["activeBattle"]),
    terrain() {
      return this.activeBattle.terrain
    }
  }
})
</script>

<style scoped lang="sass">
.no-active-battle
  height: 100%

  &>text
    fill: currentColor
    text-anchor: middle
    dominant-baseline: central
    font-family: "Fondamento"

.root, .board, .no-active-battle
  width: 100%

.root
  height: calc(100vh - 30px)
  background-color: #101010

.board
  user-select: none
  max-width: 1600px
  height: 100%
  display: flex

</style>
