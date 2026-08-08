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
          :edge-hazards="edgeHazardsByHex[hex]"
          :interactive="gameStore.battlePhaseType === BattlePhaseType.MOVE && selectionStore.movementHexes.has(hex)"
          :transform="hexTransformStr(hex)"
          :class="{ [`hex-${hex}`]: true, 'available-move': selectionStore.movementHexes.has(hex) }"
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
          :player="gameStore.playerById(creature.player)"
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
          v-for="(creature) in (gameStore.battleCarryoverTargets ?? selectionStore.engagements)"
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
          v-for="(rangestrikeTarget) in selectionStore.rangestrikes"
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
        :local-player-is-defender="localPlayerIsDefender"
        position="fixed"
        location="top right"
        class="ma-3"
      />
      <ActionPanel
        position="fixed"
        location="bottom right"
        class="ma-3 mb-10"
        :battle="activeBattle"
      />
      <v-sheet
        position="fixed"
        location="bottom left"
        class="ma-3 ml-14 mb-10"
        rounded
      >
        <FocusedStrikePanel rounded />
        <ActiveStrikePanel
          rounded
          :battle="activeBattle"
        />
      </v-sheet>

      <template v-if="selectionStore.selectedCreature && target">
        <StrikeConfirmation
          v-if="!isRangestrike(target)"
          v-model="attackCreatureDialog"
          v-model:optional-to-hit="optionalToHit"
          :battle="activeBattle"
          :attacker="selectionStore.selectedCreature"
          :targeted-creature="target"
          @attack="attackTargetedCreature(selectionStore.selectedCreature, target)"
          @cancel="resetAttack"
        />
        <RangestrikeConfirmation
          v-else
          v-model="attackCreatureDialog"
          :battle="activeBattle"
          :attacker="selectionStore.selectedCreature"
          :target="target"
          @attack="attackTargetedCreature(selectionStore.selectedCreature, target)"
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
  Battle,
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
import { useGameStore } from "~/stores/game"
import { usePlayerStore } from "~/stores/ui/player"
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

const gameStore = useGameStore()
const playerStore = usePlayerStore()
const preferencesStore = usePreferencesStore()
const selectionStore = useSelectionStore()

const target = ref<BattleCreature | RangestrikeTarget | undefined>(undefined)
const optionalToHit = ref<number | undefined>(undefined)
const debugHex = ref(0)

// gameStore.game is deeply reactive, and Vue's UnwrapNestedRefs can't reconstruct Battle's
// private methods, so the inferred type structurally mismatches the class - cast it back.
const activeBattle = computed(() => gameStore.game.activeBattle as Battle | undefined)

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

const edgeHazardsByHex = computed((): Record<number, Record<number, EdgeHazard>> =>
  Object.fromEntries(BATTLE_BOARD_HEXES.map((hex: number): [number, Record<number, EdgeHazard>] =>
    [hex, edgesForHex(hex)])))

const defender = computed((): PlayerId => activeBattle.value!.defender)

const localPlayerIsDefender = computed((): boolean =>
  defender.value === gameStore.players[playerStore.localPlayer].id)

const activeCreatures = computed((): BattleCreature[] =>
  activeBattle.value!.creatures.filter((creature: BattleCreature) =>
    creature.hex > 0 && creature.hex < 36))

function creatureEnabled(creature: BattleCreature): boolean {
  if (creature.player !== gameStore.battleActivePlayer) {
    return false
  }
  const engagementsCount = gameStore.battleEngagements(creature).length
  const rangestrikesCount = gameStore.battleRangestrikeTargets(creature).length
  switch (gameStore.battlePhaseType) {
    case BattlePhaseType.MOVE:
      return engagementsCount === 0
    case BattlePhaseType.STRIKE:
      if (!creature.hasStruck && rangestrikesCount > 0) {
        return true
      }

    case BattlePhaseType.STRIKEBACK:
      return gameStore.battleCarryoverTargets === undefined && !creature.hasStruck && engagementsCount > 0
    default:
      return false
  }
}

function creatureClasses(creature: BattleCreature): object {
  return {
    "active-player": creature.player === gameStore.battleActivePlayer,
    interactive: creatureEnabled(creature),
    selected: creature === selectionStore.selectedCreature,
    attacker: activeStrike.value?.attacker === creature.hex,
    target: activeStrike.value?.target === creature.hex
  }
}

const activeStrike = computed((): ActiveStrike | undefined => activeBattle.value!.activeStrike)

const targetedStrike = computed((): Strike =>
  selectionStore.selectedCreature && target.value
    ? activeBattle.value!.getTargetedStrike(selectionStore.selectedCreature, target.value)
    : { toHit: 0, dice: 0 })

const debugHexAdjacencies = computed((): number[] => BATTLE_BOARD_ADJACENCIES[debugHex.value] ?? [])

function moveSelected(hex: number): void {
  if (selectionStore.selectedCreature && selectionStore.movementHexes.has(hex)) {
    void gameStore.moveCreature({ creature: selectionStore.selectedCreature, hex })
  }
}

function chooseCreature(creature: BattleCreature): void {
  if (creatureEnabled(creature)) {
    selectionStore.selectCreature(creature)
  }
}

function targetCreature(creature: BattleCreature | RangestrikeTarget): void {
  if (!("creature" in creature) && activeStrike.value?.canCarryover && gameStore.battleCarryoverTargets) {
    if (gameStore.battleCarryoverTargets.includes(creature)) {
      void gameStore.assignCarryover(creature)
    }
  } else {
    target.value = creature
  }
}

async function attackTargetedCreature(
  attacker: BattleCreature,
  attackTarget: BattleCreature | RangestrikeTarget
): Promise<void> {
  console.log(attacker, target.value)
  if (diceRoller?.value == null) {
    throw new Error("diceRoller ref is not set")
  }
  const rolls = await diceRoller.value.roll(targetedStrike.value.dice)
  await (isRangestrike(attackTarget)
    ? gameStore.rangestrikeCreature({ attacker, target: attackTarget, rolls })
    : gameStore.attackCreature({
      attacker,
      target: attackTarget,
      optionalToHit: optionalToHit.value,
      rolls
    }))
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
