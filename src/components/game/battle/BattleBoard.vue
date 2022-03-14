<template>
  <div class="battleboard-root" :class="activeBattle === undefined ? 'inactive' : Terrain[terrain].toLowerCase()">
    <svg v-if="activeBattle === undefined" class="no-active-battle" viewBox="-100 -50 200 100">
      <text x="0" y="0">No Active Battle!</text>
    </svg>
    <template v-else>
      <v-card absolute top left class="ma-3">
        <v-card-title>Battle Land: {{ Terrain[terrain] }}</v-card-title>
      </v-card>
      <svg class="board" viewBox="-450 -450 800 800" @click="deselectCreature">
        <BattleBoardHex
          v-for="hex in hexes"
          :key="hex"
          :elevation="board.getElevation(hex)"
          :hazard="board.getHazard(hex)"
          :edge-hazards="edgesForHex(hex)"
          :interactive="movementHexes.has(hex)"
          :transform="hexTransformStr(hex)"
          :class="{ [`hex-${hex}`]: true, 'available-move': movementHexes.has(hex) }"
          @click="moveSelected(hex)"
          @mouseenter="enterBattleHex(hex)"
          @mouseleave="leaveBattleHex(hex)"
        />
        <g v-if="debugUi" class="debug-ui">
          <text
            v-for="hex in hexes"
            :key="hex"
            class="debug-hex-id"
            :class="{'debug-adjacent': debugHexAdjacencies.includes(hex), 'debug-selected': debugHex === hex}"
            :transform="`${hexTransformStr(hex)}`"
            @click.stop="debugHex = hex"
            v-text="hex"
          />
        </g>
        <Creature
          v-for="(creature, index) in activeOffense"
          :key="index"
          :type="creature.type"
          :player="playerById(activeBattle.attacker)"
          :wounds="creature.wounds"
          :transform="`${hexTransformStr(creature.hex)} scale(0.9)
           rotate(${120 * (activeBattle.attackerEdge - 1)})`"
          in-svg
        />
        <Creature
          v-for="(creature, index) in activeDefense"
          :key="index"
          :type="creature.type"
          :player="playerById(activeBattle.defender)"
          :wounds="creature.wounds"
          :transform="`${hexTransformStr(creature.hex)} scale(0.9)
           rotate(${180 + 120 * (activeBattle.attackerEdge - 1)})`"
          in-svg
        />
      </svg>
      <CreaturePanel />
      <ActionPanel />
      <v-card absolute bottom right class="ma-3">
        <v-card-title>Round: {{ activeBattle.round + 1 }} - {{ phaseTitle }}</v-card-title>
      </v-card>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapGetters, mapMutations, mapState } from "vuex"
import {
  BATTLE_BOARD_ADJACENCIES,
  BATTLE_BOARD_HEXES,
  BATTLE_BOARDS,
  BattleBoard,
  BattleCreature,
  BattlePhase,
  EdgeHazard,
  relationToHex
} from "~/models/battle"
import { Terrain } from "~/models/masterboard"
import Creature from "../Creature.vue"
import ActionPanel from "./ActionPanel.vue"
import BattleBoardHex from "./BattleBoardHex.vue"
import CreaturePanel from "./CreaturePanel.vue"
import { hexTransformStr } from "./utils"

export default defineComponent({
  name: "BattleBoard",
  components: { ActionPanel, CreaturePanel, Creature, BattleBoardHex },
  data: () => ({
    Terrain,
    BattlePhase,
    hexTransformStr,
    debugHex: 0
  }),
  computed: {
    ...mapState("ui/preferences", ["debugUi"]),
    ...mapState("game", ["activeBattle"]),
    ...mapGetters("game", ["playerById"]),
    ...mapGetters("ui/selections", ["movementHexes", "selectedCreature"]),
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
    },
    activeOffense(): BattleCreature[] {
      return this.activeBattle.offense.filter((creature: BattleCreature) =>
        creature.hex > 0 && creature.hex < 36)
    },
    activeDefense(): BattleCreature[] {
      return this.activeBattle.defense.filter((creature: BattleCreature) =>
        creature.hex > 0 && creature.hex < 36)
    },
    phaseTitle(): string {
      switch (this.activeBattle.phase) {
        case BattlePhase.DEFENDER_MOVE:
          return "Defender's Move"
        case BattlePhase.DEFENDER_STRIKE:
          return "Defender's Strikes"
        case BattlePhase.ATTACKER_STRIKEBACK:
          return "Attacker's Strikebacks"
        case BattlePhase.ATTACKER_MOVE:
          return "Attacker's Move"
        case BattlePhase.ATTACKER_STRIKE:
          return "Attacker's Strikes"
        case BattlePhase.DEFENDER_STRIKEBACK:
          return "Defender's Strikebacks"
        default:
          return "Unknown Phase"
      }
    },
    debugHexAdjacencies(): number[] {
      return BATTLE_BOARD_ADJACENCIES[this.debugHex] ?? []
    }
  },
  methods: {
    ...mapMutations("ui/selections", ["enterBattleHex", "leaveBattleHex", "deselectCreature"]),
    moveSelected(hex: number): void {
      if (this.movementHexes.has(hex)) {
        this.selectedCreature.hex = hex
      }
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

.battleboard-root, .board, .no-active-battle
  width: 100%

.battleboard-root
  height: calc(100vh - 30px)
  background-color: #101010

.board
  user-select: none
  max-width: 1600px
  height: 100%
  display: flex
  background: rgb(var(--v-theme-surface-variant))

@include battlemap-colors(".board :deep(.hex)", fill)

.available-move
  cursor: pointer

.debug-hex-id
  text-anchor: middle
  dominant-baseline: middle
  font-size: 56px
  fill: orange
  stroke-width: 2.5px
  cursor: crosshair

  &.debug-selected
    stroke: red

  &.debug-adjacent
    stroke: lime

</style>
