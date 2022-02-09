<template>
  <div class="root" :class="Terrain[terrain].toLowerCase()">
    <svg v-if="activeBattle === undefined" class="no-active-battle" viewBox="-100 -50 200 100">
      <text x="0" y="0">No Active Battle!</text>
    </svg>
    <template v-else>
      <v-card absolute top left class="ma-3">
        <v-card-title>Battle Land: {{ Terrain[terrain] }}</v-card-title>
      </v-card>
      <svg class="board" viewBox="-450 -450 800 800">
        <BattleBoardHex
          v-for="hex in hexes"
          :key="hex"
          :elevation="board.getElevation(hex)"
          :hazard="board.getHazard(hex)"
          :edge-hazards="board.getEdgeHazards(hex)"
          :transform="hexTransformStr(hex)"
        />
        <Creature
          v-for="(creature, index) in activeBattle.offense"
          :key="index"
          :type="creature.type"
          :player="activeBattle.attacker"
          :wounds="creature.wounds"
          :transform="`${hexTransformStr(creature.hex)} scale(0.9)`"
          in-svg
        />
        <Creature
          v-for="(creature, index) in activeBattle.defense"
          :key="index"
          :type="creature.type"
          :player="activeBattle.defender"
          :wounds="creature.wounds"
          :transform="`${hexTransformStr(creature.hex)} scale(0.9)`"
          in-svg
        />
      </svg>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapState } from "vuex"
import { BATTLE_BOARDS, BattleBoard } from "~/models/battle"
import { Terrain } from "~/models/masterboard"
import Creature from "../Creature.vue"
import BattleBoardHex from "./BattleBoardHex.vue"
import { hexTransformStr } from "./utils"

export default defineComponent({
  name: "BattleBoard",
  components: { Creature, BattleBoardHex },
  data: () => ({
    Terrain,
    hexTransformStr
  }),
  computed: {
    ...mapState("game", ["activeBattle"]),
    terrain(): Terrain {
      return this.activeBattle.terrain
    },
    board(): BattleBoard {
      return BATTLE_BOARDS[this.terrain]
    },
    hexes(): number[] {
      return [
        2, 3, 4,
        7, 8, 9, 10,
        13, 14, 15, 16, 17,
        18, 19, 20, 21, 22, 23,
        25, 26, 27, 28, 29,
        31, 32, 33, 34
      ]
    }
  }
})
</script>

<style scoped lang="sass">
@import "@/styles/terrain-colors.sass"

.no-active-battle
  height: 100%

  &>text
    fill: currentColor
    text-anchor: middle
    dominant-baseline: central
    font-family: "Fondamento", serif

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
  background: rgb(var(--v-theme-surface-variant))

@include battlemap-colors(".board :deep(.hex)", fill)

</style>
