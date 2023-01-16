<template>
  <div class="battleboard-root" :class="activeBattle === undefined ? 'inactive' : Terrain[terrain].toLowerCase()">
    <svg v-if="activeBattle === undefined" class="no-active-battle" viewBox="-100 -50 200 100">
      <text x="0" y="0">No Active Battle!</text>
    </svg>
    <template v-else>
      <v-card position="absolute" location="top left" class="ma-3 ml-14">
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
          @mouseenter="enterCreature(creature)"
          @mouseleave="leaveCreature(creature)"
        />
        <EngageIcon
          v-for="(creature) in (battleCarryoverTargets ?? engagements)"
          :key="creature.hex"
          interactive
          transparent-hover
          :transform="`${hexTransformStr(creature.hex)} scale(0.9)
           rotate(${120 * (activeBattle.attackerEdge - 1) + (creature.player === defender ? 180 : 0)})`"
          @click.stop="targetCreature(creature)"
          @mouseenter="enterCreature(creature)"
          @mouseleave="leaveCreature(creature)"
        />
      </svg>

      <CreaturePanel position="fixed" location="top right" class="ma-3" />
      <ActionPanel position="fixed" location="bottom right" class="ma-3 mb-10" />
      <v-sheet position="fixed" location="bottom left" class="ma-3 ml-14 mb-10" rounded>
        <FocusedStrikePanel rounded />
        <ActiveStrikePanel rounded />
      </v-sheet>

      <StrikeConfirmation
        v-model="attackCreatureDialog"
        v-model:optionalToHit="optionalToHit"
        :targeted-creature="targetedCreature"
        :targeted-strike="targetedStrike"
        :targeted-strike-unadjusted="targetedStrikeUnadjusted"
        :normal-carryovers="normalCarryovers"
        :tougher-carryovers="tougherCarryovers"
        @attack="attackTargetedCreature"
        @cancel="resetAttack"
      />
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapActions, mapGetters, mapMutations, mapState } from "vuex"
import {
  ActiveStrike,
  BATTLE_BOARD_ADJACENCIES,
  BATTLE_BOARD_HEXES,
  BATTLE_BOARDS,
  BATTLE_PHASE_TITLES,
  BattleBoard,
  BattleCreature,
  BattlePhase,
  BattlePhaseType,
  EdgeHazard,
  relationToHex,
  Strike
} from "~/models/battle"
import { Terrain } from "~/models/masterboard"
import { PlayerId } from "~/models/player"
import Creature from "../Creature.vue"
import EngageIcon from "../masterboard/EngageIcon.vue"
import ActionPanel from "./ActionPanel.vue"
import ActiveStrikePanel from "./ActiveStrikePanel.vue"
import BattleBoardHex from "./BattleBoardHex.vue"
import CreaturePanel from "./CreaturePanel.vue"
import FocusedStrikePanel from "./FocusedStrikePanel.vue"
import StrikeConfirmation from "./StrikeConfirmation.vue"
import { hexTransformStr } from "./utils"

export default defineComponent({
  name: "BattleBoard",
  components: {
    StrikeConfirmation,
    EngageIcon,
    ActionPanel,
    CreaturePanel,
    Creature,
    BattleBoardHex,
    ActiveStrikePanel,
    FocusedStrikePanel
  },
  inject: ["diceRoller"],
  data: (): any | { targetedCreature: BattleCreature } => ({
    Terrain,
    BattlePhase,
    BattlePhaseType,
    BATTLE_PHASE_TITLES,
    hexTransformStr,
    targetedCreature: undefined,
    optionalToHit: undefined,
    debugHex: 0
  }),
  computed: {
    ...mapState("ui/preferences", ["debugUi"]),
    ...mapState("game", ["activeBattle"]),
    ...mapGetters("game", ["playerById", "battleActivePlayer", "battlePhaseType", "battleEngagements",
      "battleCarryoverTargets"]),
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
      return BATTLE_BOARDS[this.terrain as Terrain]
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
        if (creature.player !== this.battleActivePlayer) {
          return false
        }
        const engagements = this.battleEngagements(creature).length
        switch (this.battlePhaseType) {
          case BattlePhaseType.MOVE:
            return engagements === 0
          case BattlePhaseType.STRIKE:
          case BattlePhaseType.STRIKEBACK:
            return this.battleCarryoverTargets === undefined && !creature.hasStruck && engagements > 0
          default:
            return false
        }
      }
    },
    creatureClasses(): (creature: BattleCreature) => object {
      return (creature: BattleCreature) => ({
        "active-player": creature.player === this.battleActivePlayer,
        interactive: this.creatureEnabled(creature),
        selected: creature === this.selectedCreature,
        attacker: this.activeStrike?.attacker === creature.hex,
        target: this.activeStrike?.target === creature.hex
      })
    },
    activeStrike(): ActiveStrike | undefined {
      return this.activeBattle.activeStrike
    },
    targetedStrikeUnadjusted(): Strike {
      if (this.selectedCreature && this.targetedCreature) {
        return this.activeBattle.getRawStrike(this.selectedCreature, this.targetedCreature)
      }
      return { toHit: 0, dice: 0 }
    },
    targetedStrike(): Strike {
      return this.selectedCreature && this.targetedCreature
        ? this.activeBattle.getAdjustedStrike(this.selectedCreature, this.targetedCreature)
        : { toHit: 0, dice: 0 }
    },
    carryoversImpossible(): boolean {
      return this.selectedCreature === undefined ||
        this.targetedCreature === undefined ||
        this.engagements.length < 2 ||
        this.targetedStrike.dice - this.targetedCreature.getRemainingHp() <= 0
    },
    normalCarryovers(): BattleCreature[] {
      return this.carryoversImpossible ? [] : this.engagements
        .filter((target: BattleCreature) =>
          this.activeBattle.toHitAdjusted(this.selectedCreature, target) <= this.targetedStrike.toHit)
        .filter((target: BattleCreature) => this.targetedCreature !== target)
    },
    tougherCarryovers(): BattleCreature[] {
      return this.carryoversImpossible ? [] : this.engagements.filter((target: BattleCreature) =>
        this.activeBattle.toHitAdjusted(this.selectedCreature, target) > this.targetedStrike.toHit)
    },
    debugHexAdjacencies(): number[] {
      return BATTLE_BOARD_ADJACENCIES[this.debugHex] ?? []
    }
  },
  methods: {
    ...mapMutations("ui/selections", [
      "enterBattleHex", "leaveBattleHex", "selectCreature", "deselectCreature",
      "enterCreature", "leaveCreature"
    ]),
    ...mapActions("game", ["moveCreature", "attackCreature", "assignCarryover"]),
    moveSelected(hex: number): void {
      if (this.selectedCreature && this.movementHexes.has(hex)) {
        this.moveCreature({ creature: this.selectedCreature, hex })
      }
    },
    chooseCreature(creature: BattleCreature): void {
      if (this.creatureEnabled(creature)) {
        this.selectCreature(creature)
      }
    },
    targetCreature(creature: BattleCreature): void {
      if (this.activeStrike?.canCarryover && this.battleCarryoverTargets) {
        if (this.battleCarryoverTargets.includes(creature)) {
          this.assignCarryover(creature)
        }
      } else {
        this.targetedCreature = creature
      }
    },
    async attackTargetedCreature(): Promise<void> {
      console.log(this.selectedCreature, this.targetedCreature)
      const rolls = await this.diceRoller.roll(this.targetedStrike.dice)
      await this.attackCreature({
        attacker: this.selectedCreature,
        target: this.targetedCreature,
        optionalToHit: this.optionalToHit,
        rolls
      })
      console.log(this.activeBattle.activeStrike)
      this.resetAttack()
      this.deselectCreature()
    },
    resetAttack(): void {
      this.targetedCreature = undefined
      this.optionalToHit = undefined
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
  &.attacker
    outline: solid rgb(var(--v-theme-info)) 4px
    outline-offset: -1px
  &.target
    outline: solid rgb(var(--v-theme-error)) 4px
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
