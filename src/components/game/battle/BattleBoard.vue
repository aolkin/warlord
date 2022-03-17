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
          v-for="(creature, index) in activeCreatures"
          :key="index"
          :type="creature.type"
          :player="playerById(creature.player)"
          :wounds="creature.wounds"
          class="battle-creature"
          :class="creatureClasses(creature)"
          :transform="`${hexTransformStr(creature.hex)} scale(0.9)
           rotate(${120 * (activeBattle.attackerEdge - 1) + (creature.player === defender ? 180 : 0)})`"
          in-svg
          @click.stop="chooseCreature(creature)"
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
import { mapActions, mapGetters, mapMutations, mapState } from "vuex"
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
import { PlayerId } from "~/models/player"
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
    ...mapGetters("game", ["playerById", "battleActivePlayer"]),
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
    attacker(): PlayerId {
      return this.activeBattle.attacker
    },
    defender(): PlayerId {
      return this.activeBattle.defender
    },
    activeCreatures(): BattleCreature[] {
      return this.activeBattle.creatures.filter((creature: BattleCreature) =>
        creature.hex > 0 && creature.hex < 36)
    },
    creatureClasses(): (creature: BattleCreature) => object {
      return (creature: BattleCreature) => ({
        interactive: (creature.player === this.battleActivePlayer)
      })
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
    ...mapMutations("ui/selections", [
      "enterBattleHex", "leaveBattleHex", "selectCreature", "deselectCreature"
    ]),
    ...mapActions("game", ["moveCreature"]),
    moveSelected(hex: number): void {
      if (this.selectedCreature && this.movementHexes.has(hex)) {
        this.moveCreature({ creature: this.selectedCreature, hex })
      }
    },
    chooseCreature(creature: BattleCreature): void {
      if ((this.activeBattle.phase === BattlePhase.ATTACKER_MOVE && creature.player === this.attacker) ||
        (this.activeBattle.phase === BattlePhase.DEFENDER_MOVE && creature.player === this.defender)) {
        this.selectCreature(creature)
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

.battle-creature
  &.interactive
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
