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
          :edge-hazards="edgesForHex(hex)"
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
import {
  BATTLE_BOARD_ADJACENCIES,
  BATTLE_BOARD_HEXES,
  BATTLE_BOARDS,
  BattleBoard,
  EdgeHazard,
  relationToHex
} from "~/models/battle"
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
    hexes(): readonly number[] {
      return BATTLE_BOARD_HEXES
    },
    edgesForHex(): ((hex: number) => Record<number, EdgeHazard>) {
      return (hex: number) => Object.fromEntries(BATTLE_BOARD_ADJACENCIES[hex]
        .map((adjacency: number): [number, EdgeHazard] =>
          [relationToHex(hex, adjacency), this.board.getEdgeHazard(adjacency, hex)])
        .filter(([, hazard]: [number, EdgeHazard]) => hazard !== EdgeHazard.NONE)
      )
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
