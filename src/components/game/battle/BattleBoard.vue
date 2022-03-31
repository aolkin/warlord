<template>
  <div class="battleboard-root" :class="activeBattle === undefined ? 'inactive' : Terrain[terrain].toLowerCase()">
    <svg v-if="activeBattle === undefined" class="no-active-battle" viewBox="-100 -50 200 100">
      <text x="0" y="0">No Active Battle!</text>
    </svg>
    <template v-else>
      <v-card absolute top left class="ma-3">
        <v-card-title>Battle Land: {{ Terrain[terrain] }}</v-card-title>
        <v-card-title>
          Round: {{ activeBattle.round + 1 }} - {{ BATTLE_PHASE_TITLES[activeBattle.phase] }}
        </v-card-title>
      </v-card>
      <svg class="board" viewBox="-450 -450 800 800" @click="deselectCreature">
        <BattleBoardHex
          v-for="hex in hexes"
          :key="hex"
          :elevation="board.getElevation(hex)"
          :hazard="board.getHazard(hex)"
          :edge-hazards="edgesForHex(hex)"
          :interactive="battlePhaseType === BattlePhaseType.MOVE && movementHexes.has(hex)"
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
          v-for="(creature) in activeCreatures"
          :key="creature.hex"
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
        <EngageIcon
          v-for="(creature) in engagements"
          :key="creature.hex"
          interactive
          transparent-hover
          :transform="`${hexTransformStr(creature.hex)} scale(0.9)
           rotate(${120 * (activeBattle.attackerEdge - 1) + (creature.player === defender ? 180 : 0)})`"
          @click.stop="targetedCreature = creature"
        />
      </svg>
      <CreaturePanel absolute top right />
      <ActionPanel absolute bottom right />

      <v-dialog v-model="attackCreatureDialog">
        <v-card>
          <v-card-title>
            Attack {{ targetedCreatureName }} with {{ selectedCreatureName }}?
          </v-card-title>
          <v-card-text>
            Are you sure you want to attack this {{ targetedCreatureName }} ({{ targetedCreature?.wounds }} hits)
            with your {{ selectedCreatureName }}?
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" color="secondary" @click="targetedCreature = undefined">Cancel</v-btn>
            <v-btn color="primary" class="float-right" @click="attackTargetedCreature">Attack</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
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
  BATTLE_PHASE_TITLES,
  BattleBoard,
  BattleCreature,
  BattlePhase,
  BattlePhaseType,
  EdgeHazard,
  relationToHex
} from "~/models/battle"
import { CREATURE_DATA } from "~/models/creature"
import { Terrain } from "~/models/masterboard"
import { PlayerId } from "~/models/player"
import Creature from "../Creature.vue"
import EngageIcon from "../masterboard/EngageIcon.vue"
import ActionPanel from "./ActionPanel.vue"
import BattleBoardHex from "./BattleBoardHex.vue"
import CreaturePanel from "./CreaturePanel.vue"
import { hexTransformStr } from "./utils"

export default defineComponent({
  name: "BattleBoard",
  components: { EngageIcon, ActionPanel, CreaturePanel, Creature, BattleBoardHex },
  data: () => ({
    Terrain,
    BattlePhase,
    BattlePhaseType,
    BATTLE_PHASE_TITLES,
    hexTransformStr,
    targetedCreature: undefined,
    debugHex: 0
  }),
  computed: {
    ...mapState("ui/preferences", ["debugUi"]),
    ...mapState("game", ["activeBattle"]),
    ...mapGetters("game", ["playerById", "battleActivePlayer", "battlePhaseType", "battleEngagements"]),
    ...mapGetters("ui/selections", ["movementHexes", "selectedCreature", "engagements"]),
    attackCreatureDialog: {
      get(): boolean {
        return this.targetedCreature !== undefined
      },
      set(val: boolean): void {
        if (!val) {
          this.targetedCreature = undefined
        }
      }
    },
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
    creatureEnabled(): (creature: BattleCreature) => boolean {
      return (creature) => {
        const engagements = this.battleEngagements(creature).length
        return this.battlePhaseType === BattlePhaseType.MOVE ? engagements === 0 : engagements !== 0
      }
    },
    creatureClasses(): (creature: BattleCreature) => object {
      return (creature: BattleCreature) => ({
        "active-player": creature.player === this.battleActivePlayer,
        interactive: (creature.player === this.battleActivePlayer && this.creatureEnabled(creature)),
        selected: creature === this.selectedCreature
      })
    },
    selectedCreatureName(): string {
      return this.selectedCreature !== undefined ? CREATURE_DATA[this.selectedCreature.type].name : ""
    },
    targetedCreatureName(): string {
      return this.targetedCreature !== undefined ? CREATURE_DATA[this.targetedCreature.type].name : ""
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
      if (creature.player === this.battleActivePlayer && this.creatureEnabled(creature)) {
        this.selectCreature(creature)
      }
    },
    attackTargetedCreature(): void {
      console.log(this.selectedCreature, this.targetedCreature)
      this.targetedCreature = undefined
      this.deselectCreature()
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
  &.active-player
    filter: brightness(0.75)
  &.interactive
    filter: none
    cursor: pointer
  &.selected
    outline: solid rgb(var(--v-theme-secondary)) 3px
    outline-offset: -1px

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
