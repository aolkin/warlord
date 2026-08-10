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
        <v-card-subtitle v-if="preferencesStore.debugUi && focusedBattleHex !== undefined">
          Hex: {{ focusedBattleHex }} ({{ Hazard[board.getHazard(focusedBattleHex)] }})
          <span v-if="board.getElevation(focusedBattleHex) > 0">+{{ board.getElevation(focusedBattleHex) }}</span>
        </v-card-subtitle>
      </v-card>
      <svg
        class="board"
        viewBox="-450 -450 800 800"
        @click="deselectCreature"
      >
        <BattleBoardHex
          v-for="hex in BATTLE_BOARD_HEXES"
          :key="hex"
          :elevation="board.getElevation(hex)"
          :hazard="board.getHazard(hex)"
          :edge-hazards="edgeHazardsByHex[hex]"
          :interactive="battlePhaseType === BattlePhaseType.MOVE && movementHexes.has(hex)"
          :transform="hexTransformStr(hex)"
          :class="{ [`hex-${hex}`]: true, 'available-move': movementHexes.has(hex) }"
          @click="moveSelected(hex)"
          @mouseenter="enterBattleHex(hex)"
          @mouseleave="leaveBattleHex(hex)"
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
          :player-id="creature.player"
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
          v-for="(creature) in (gameStore.battleCarryoverTargets ?? engagements)"
          :key="creature.hex"
          interactive
          transparent-hover
          :transform="`${hexTransformStr(creature.hex)} scale(0.9)
           rotate(${120 * (activeBattle.attackerEdge - 1) + (creature.player === defender ? 0 : 180)})`"
          @click.stop="targetCreature(creature)"
          @mouseenter="enterCreature(creature)"
          @mouseleave="leaveCreature(creature)"
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
          @mouseenter="enterCreature(rangestrikeTarget.creature)"
          @mouseleave="leaveCreature(rangestrikeTarget.creature)"
        />
      </svg>

      <CreaturePanel
        :local-player-is-defender="localPlayerIsDefender"
        :selected-creature-id="selectedCreatureId"
        :selected-can-leave-board="selectedCanLeaveBoard"
        position="fixed"
        location="top right"
        class="ma-3"
        @select="selectCreature"
        @remove="removeSelected"
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
        <FocusedStrikePanel
          v-if="selectedCreature && focusedCreature"
          rounded
          :attacker="selectedCreature"
          :focused-creature="focusedCreature"
        />
        <ActiveStrikePanel
          rounded
          :battle="activeBattle"
        />
      </v-sheet>

      <template v-if="selectedCreature && target">
        <StrikeConfirmation
          v-if="!isRangestrike(target)"
          v-model="attackCreatureDialog"
          v-model:optional-to-hit="optionalToHit"
          :battle="activeBattle"
          :attacker="selectedCreature"
          :targeted-creature="target"
          @attack="attackTargetedCreature(selectedCreature, target)"
          @cancel="resetAttack"
        />
        <RangestrikeConfirmation
          v-else
          v-model="attackCreatureDialog"
          :battle="activeBattle"
          :attacker="selectedCreature"
          :target="target"
          @attack="attackTargetedCreature(selectedCreature, target)"
          @cancel="resetAttack"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, Ref, ref, shallowReactive, shallowRef, watch } from "vue"
import {
  ActiveStrike,
  BATTLE_BOARD_ADJACENCIES,
  BATTLE_BOARD_HEXES,
  BATTLE_BOARDS,
  BATTLE_PHASE_TITLES,
  BATTLE_PHASE_TYPES,
  Battle,
  BattleBoard,
  BattleCreature,
  BattlePhaseType,
  EdgeHazard,
  Hazard,
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
const game = gameStore.game
const playerStore = usePlayerStore()
const preferencesStore = usePreferencesStore()

const target = ref<BattleCreature | RangestrikeTarget | undefined>(undefined)
const optionalToHit = ref<number | undefined>(undefined)
const debugHex = ref(0)

// BattleCreature instances here always come from the game store's own reactive state, so
// they're already reactive proxies by the time they reach these - shallow refs/collections
// avoid Vue re-wrapping their internals a second time, which for a class with private fields
// also trips up TypeScript (Vue's deep UnwrapRef can't reconstruct a private field, so the
// mapped type stops matching the class).
const selectedCreature = shallowRef<BattleCreature>()
const focusedCreatures = shallowReactive<BattleCreature[]>([])

const focusedCreature = computed<BattleCreature | undefined>(() => focusedCreatures.length > 0
  ? focusedCreatures[focusedCreatures.length - 1]
  : selectedCreature.value)

const movementHexes = computed<Set<number>>(() =>
  selectedCreature.value === undefined ? new Set<number>() : activeBattle.value!.movementFor(selectedCreature.value))
const engagements = computed<BattleCreature[]>(() =>
  selectedCreature.value === undefined ? [] : activeBattle.value!.engagedWith(selectedCreature.value))
const rangestrikes = computed<RangestrikeTarget[]>(() =>
  selectedCreature.value === undefined ? [] : activeBattle.value!.rangestrikeTargets(selectedCreature.value))

function selectCreature(selection: BattleCreature): void {
  selectedCreature.value = selectedCreature.value === selection ? undefined : selection
}

function deselectCreature(): void {
  selectedCreature.value = undefined
}

function enterCreature(entering: BattleCreature): void {
  if (!focusedCreatures.includes(entering)) {
    focusedCreatures.push(entering)
  }
}

function leaveCreature(leaving: BattleCreature): void {
  const index = focusedCreatures.indexOf(leaving)
  if (index !== -1) {
    focusedCreatures.splice(index)
  }
}

const focusedBattleHexes = shallowReactive<number[]>([])

const focusedBattleHex = computed<number | undefined>(() => focusedBattleHexes.length > 0
  ? focusedBattleHexes[focusedBattleHexes.length - 1]
  : undefined)

function enterBattleHex(entering: number): void {
  if (!focusedBattleHexes.includes(entering)) {
    focusedBattleHexes.push(entering)
  }
}

function leaveBattleHex(leaving: number): void {
  const index = focusedBattleHexes.indexOf(leaving)
  if (index !== -1) {
    focusedBattleHexes.splice(index)
  }
}

// game is deeply reactive, and Vue's UnwrapNestedRefs can't reconstruct Battle's
// private methods, so the inferred type structurally mismatches the class - cast it back.
const activeBattle = computed(() => game.activeBattle as Battle | undefined)
const battlePhaseType = computed((): BattlePhaseType | undefined =>
  activeBattle.value === undefined ? undefined : BATTLE_PHASE_TYPES[activeBattle.value.phase])
const battleActivePlayer = computed((): PlayerId | undefined => activeBattle.value?.getActivePlayer())

// A creature only exists within the battle it was selected in.
watch(activeBattle, deselectCreature)
watch(battlePhaseType, deselectCreature)

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
  defender.value === game.players[playerStore.localPlayer].id)

const selectedCreatureId = computed((): number | undefined => selectedCreature.value?.id)

const selectedStartedOffBoard = computed((): boolean =>
  (selectedCreature.value?.initialHex ?? -1) >= 36)

// True once a creature that started off-board has been moved onto the board this turn,
// making it eligible to be moved back off (PendingCreatures' "Put Back" action).
const selectedCanLeaveBoard = computed((): boolean =>
  selectedStartedOffBoard.value && (selectedCreature.value?.hex ?? -1) < 36)

const activeCreatures = computed((): BattleCreature[] =>
  activeBattle.value!.creatures.filter((creature: BattleCreature) =>
    creature.hex > 0 && creature.hex < 36))

function creatureEnabled(creature: BattleCreature): boolean {
  if (creature.player !== battleActivePlayer.value) {
    return false
  }
  const engagementsCount = activeBattle.value!.engagedWith(creature).length
  const rangestrikesCount = activeBattle.value!.rangestrikeTargets(creature).length
  switch (battlePhaseType.value) {
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
    void game.moveCreature({ creature: selectedCreature.value.id, hex })
  }
}

function removeSelected(): void {
  if (selectedCreature.value) {
    void game.moveCreature({ creature: selectedCreature.value.id, hex: selectedCreature.value.initialHex })
  }
}

function chooseCreature(creature: BattleCreature): void {
  if (creatureEnabled(creature)) {
    selectCreature(creature)
  }
}

function targetCreature(creature: BattleCreature | RangestrikeTarget): void {
  if (!("creature" in creature) && activeStrike.value?.canCarryover && gameStore.battleCarryoverTargets) {
    if (gameStore.battleCarryoverTargets.includes(creature)) {
      void game.assignCarryover(creature.id)
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
    ? game.rangestrikeCreature({
      attacker: attacker.id,
      target: { ...attackTarget, creature: attackTarget.creature.id },
      rolls
    })
    : game.attackCreature({
      attacker: attacker.id,
      target: attackTarget.id,
      optionalToHit: optionalToHit.value,
      rolls
    }))
  console.log(activeBattle.value!.activeStrike)
  resetAttack()
  deselectCreature()
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
