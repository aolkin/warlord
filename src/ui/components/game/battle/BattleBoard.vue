<template>
  <div
    class="battleboard-root"
    :class="activeBattle === undefined ? 'inactive' : Terrain[terrain].toLowerCase()"
  >
    <svg
      v-if="activeBattle === undefined"
      class="no-active-battle"
      viewBox="-100 -50 200 100"
    >
      <text
        x="0"
        y="0"
      >No Active Battle!</text>
    </svg>
    <template v-else>
      <v-card
        position="absolute"
        location="top left"
        class="ma-3 ml-14"
      >
        <v-card-title>Battle Land: {{ Terrain[terrain] }}</v-card-title>
        <v-card-title>
          Round: {{ activeBattle.round + 1 }} - {{ BATTLE_PHASE_TITLES[activeBattle.phase] }}
        </v-card-title>
      </v-card>
      <svg
        class="board"
        viewBox="-450 -450 800 800"
        @click="selectionStore.deselectCreature"
      >
        <BattleBoardHex
          v-for="hex in BATTLE_BOARD_HEXES"
          :key="hex"
          :elevation="board.getElevation(hex)"
          :hazard="board.getHazard(hex)"
          :edge-hazards="edgesForHex(hex)"
          :interactive="battlePhaseType === BattlePhaseType.MOVE && movementHexes.has(hex)"
          :transform="hexTransformStr(hex)"
          :class="{ [`hex-${hex}`]: true, 'available-move': movementHexes.has(hex) }"
          @click="moveSelected(hex)"
          @mouseenter="selectionStore.enterBattleHex(hex)"
          @mouseleave="selectionStore.leaveBattleHex(hex)"
        />
        <g
          v-if="preferencesStore.debugUi"
          class="debug-ui"
        >
          <text
            v-for="hex in BATTLE_BOARD_HEXES"
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
          @mouseenter="selectionStore.enterCreature(creature)"
          @mouseleave="selectionStore.leaveCreature(creature)"
        />
        <EngageIcon
          v-for="(creature) in (battleCarryoverTargets ?? engagements)"
          :key="creature.hex"
          interactive
          transparent-hover
          :transform="`${hexTransformStr(creature.hex)} scale(0.9)
           rotate(${120 * (activeBattle.attackerEdge - 1) + (creature.player === defender ? 0 : 180)})`"
          @click.stop="targetCreature(creature)"
          @mouseenter="selectionStore.enterCreature(creature)"
          @mouseleave="selectionStore.leaveCreature(creature)"
        />
        <RangestrikeIcon
          v-for="(rangestrikeTarget) in rangestrikes"
          :key="rangestrikeTarget.creature.hex"
          interactive
          transparent-hover
          :long-distance="rangestrikeTarget.longDistance"
          :adjustment="rangestrikeTarget.adjustment"
          :transform="`${hexTransformStr(rangestrikeTarget.creature.hex)} scale(0.9)
           rotate(${120 * (activeBattle.attackerEdge - 1) +
          (rangestrikeTarget.creature.player === defender ? 0 : 180)})`"
          @click.stop="targetCreature(rangestrikeTarget)"
          @mouseenter="selectionStore.enterCreature(rangestrikeTarget.creature)"
          @mouseleave="selectionStore.leaveCreature(rangestrikeTarget.creature)"
        />
      </svg>

      <CreaturePanel
        position="fixed"
        location="top right"
        class="ma-3"
      />
      <ActionPanel
        position="fixed"
        location="bottom right"
        class="ma-3 mb-10"
      />
      <v-sheet
        position="fixed"
        location="bottom left"
        class="ma-3 ml-14 mb-10"
        rounded
      >
        <FocusedStrikePanel rounded />
        <ActiveStrikePanel rounded />
      </v-sheet>

      <template v-if="selectedCreature && target">
        <StrikeConfirmation
          v-if="!isRangestrike(target)"
          v-model="attackCreatureDialog"
          v-model:optional-to-hit="optionalToHit"
          :targeted-creature="target"
          @attack="attackTargetedCreature"
          @cancel="resetAttack"
        />
        <RangestrikeConfirmation
          v-else
          v-model="attackCreatureDialog"
          :target="target"
          @attack="attackTargetedCreature"
          @cancel="resetAttack"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, Ref, ref } from "vue"
import {
  ActiveStrike,
  BATTLE_BOARD_ADJACENCIES,
  BATTLE_BOARD_HEXES,
  BATTLE_BOARDS,
  BATTLE_PHASE_TITLES,
  BattleBoard,
  BattleCreature,
  BattlePhaseType,
  EdgeHazard,
  isRangestrike,
  RangestrikeTarget,
  relationToHex,
  Strike
} from "@/models/battle"
import { Terrain } from "@/models/masterboard"
import { PlayerId } from "@/models/player"
import { useTypedStore } from "~/plugins/vuex"
import { usePreferencesStore } from "~/stores/ui/preferences"
import { useSelectionStore } from "~/stores/ui/selection"
import type DiceRoller from "~/components/ui/generic/DiceRoller"
import EngageIcon from "../../ui/game/EngageIcon.vue"
import RangestrikeIcon from "../../ui/game/RangestrikeIcon.vue"
import Creature from "../Creature.vue"
import ActionPanel from "./ActionPanel.vue"
import ActiveStrikePanel from "./ActiveStrikePanel.vue"
import BattleBoardHex from "./BattleBoardHex.vue"
import CreaturePanel from "./CreaturePanel.vue"
import FocusedStrikePanel from "./FocusedStrikePanel.vue"
import RangestrikeConfirmation from "./RangestrikeConfirmation.vue"
import StrikeConfirmation from "./StrikeConfirmation.vue"
import { hexTransformStr } from "./utils"

const diceRoller = inject<Readonly<Ref<InstanceType<typeof DiceRoller> | null>>>("diceRoller")

const preferencesStore = usePreferencesStore()
const selectionStore = useSelectionStore()
const store = useTypedStore()

const target = ref<BattleCreature | RangestrikeTarget | undefined>(undefined)
const optionalToHit = ref<number | undefined>(undefined)
const debugHex = ref(0)

const activeBattle = computed(() => store.state.game.activeBattle)
const playerById = computed(() => store.getters["game/playerById"])
const battleActivePlayer = computed(() => store.getters["game/battleActivePlayer"])
const battlePhaseType = computed((): BattlePhaseType => store.getters["game/battlePhaseType"])
const battleEngagements = computed(() => store.getters["game/battleEngagements"])
const battleCarryoverTargets = computed(() => store.getters["game/battleCarryoverTargets"])
const battleRangestrikeTargets = computed(() => store.getters["game/battleRangestrikeTargets"])
const movementHexes = computed(() => selectionStore.movementHexes)
const selectedCreature = computed((): BattleCreature | undefined => selectionStore.selectedCreature)
const engagements = computed(() => selectionStore.engagements)
const rangestrikes = computed(() => selectionStore.rangestrikes)

const attackCreatureDialog = computed({
  get: (): boolean => target.value !== undefined,
  set: (val: boolean): void => {
    if (!val) {
      target.value = undefined
    }
  }
})

const terrain = computed((): Terrain => activeBattle.value!.terrain)
const board = computed((): BattleBoard => BATTLE_BOARDS[terrain.value as Terrain])

function edgesForHex(hex: number): Record<number, EdgeHazard> {
  return Object.fromEntries(BATTLE_BOARD_ADJACENCIES[hex]
    .map((adjacency: number): [number, EdgeHazard] =>
      [relationToHex(hex, adjacency), board.value.getEdgeHazard(adjacency, hex)])
    .filter(([, hazard]: [number, EdgeHazard]) => hazard !== EdgeHazard.NONE)
  )
}

const defender = computed((): PlayerId => activeBattle.value!.defender)

const activeCreatures = computed((): BattleCreature[] =>
  activeBattle.value!.creatures.filter((creature: BattleCreature) =>
    creature.hex > 0 && creature.hex < 36))

function creatureEnabled(creature: BattleCreature): boolean {
  if (creature.player !== battleActivePlayer.value) {
    return false
  }
  const engagementsCount = battleEngagements.value(creature).length
  const rangestrikesCount = battleRangestrikeTargets.value(creature).length
  switch (battlePhaseType.value) {
    case BattlePhaseType.MOVE:
      return engagementsCount === 0
    case BattlePhaseType.STRIKE:
      if (!creature.hasStruck && rangestrikesCount > 0) {
        return true
      }

    case BattlePhaseType.STRIKEBACK:
      return battleCarryoverTargets.value === undefined && !creature.hasStruck && engagementsCount > 0
    default:
      return false
  }
}

function creatureClasses(creature: BattleCreature): object {
  return {
    "active-player": creature.player === battleActivePlayer.value,
    interactive: creatureEnabled(creature),
    selected: creature === selectedCreature.value,
    attacker: activeStrike.value?.attacker === creature.hex,
    target: activeStrike.value?.target === creature.hex
  }
}

const activeStrike = computed((): ActiveStrike | undefined => activeBattle.value!.activeStrike)

const targetedStrike = computed((): Strike =>
  selectedCreature.value && target.value
    ? activeBattle.value!.getTargetedStrike(selectedCreature.value, target.value)
    : { toHit: 0, dice: 0 })

const debugHexAdjacencies = computed((): number[] => BATTLE_BOARD_ADJACENCIES[debugHex.value] ?? [])

function moveSelected(hex: number): void {
  if (selectedCreature.value && movementHexes.value.has(hex)) {
    store.dispatch("game/moveCreature", { creature: selectedCreature.value, hex })
  }
}

function chooseCreature(creature: BattleCreature): void {
  if (creatureEnabled(creature)) {
    selectionStore.selectCreature(creature)
  }
}

function targetCreature(creature: BattleCreature | RangestrikeTarget): void {
  if (!("creature" in creature) && activeStrike.value?.canCarryover && battleCarryoverTargets.value) {
    if (battleCarryoverTargets.value.includes(creature)) {
      store.dispatch("game/assignCarryover", creature)
    }
  } else {
    target.value = creature
  }
}

async function attackTargetedCreature(): Promise<void> {
  console.log(selectedCreature.value, target.value)
  if (diceRoller?.value == null) {
    throw new Error("diceRoller ref is not set")
  }
  const rolls = await diceRoller.value.roll(targetedStrike.value.dice)
  // Only invoked from StrikeConfirmation/RangestrikeConfirmation, which only render
  // inside a `v-if="selectedCreature && target"` block.
  await store.dispatch(isRangestrike(target.value!) ? "game/rangestrikeCreature" : "game/attackCreature", {
    attacker: selectedCreature.value,
    target: target.value,
    optionalToHit: optionalToHit.value,
    rolls
  })
  console.log(activeBattle.value!.activeStrike)
  resetAttack()
  selectionStore.deselectCreature()
}

function resetAttack(): void {
  target.value = undefined
  optionalToHit.value = undefined
}
</script>

<style scoped lang="sass">
@import "~/styles/terrain-colors.sass"

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
