<template>
  <g
    :transform="transform"
    class="marker"
    :class="classes"
    @click.stop="select"
    @mouseenter="enter"
    @mouseleave="leave"
  >
    <rect
      v-for="i in stack.creatures.length"
      :key="i"
      width="100"
      height="100"
      x="-50"
      :y="-50"
      :transform="selected ? '' : `translate(0 ${4 * (stack.creatures.length - i)})`"
      :filter="`brightness(${100 - 5 * (stack.creatures.length - i)}%)`"
      class="creature"
    />
    <PlayerMarker
      :color="stack.owner"
      :marker="stack.marker"
      in-svg
    />
    <text
      x="44"
      y="45"
      class="annotation stack-size"
    >
      {{ stackSize }}
    </text>
    <text
      v-if="!selected && stacksOnHex.length > 1 && !engaged"
      x="0"
      y="0"
      class="annotation stack-count"
    >
      x{{ stacksOnHex.length }}
    </text>
    <EngageIcon v-if="engaged" />
    <EngageIcon
      v-for="[edge, iconTransform] in engageable"
      :key="edge"
      :interactive="true"
      :transform="iconTransform"
      @click="attack(edge)"
    />
    <transition name="muster">
      <g
        v-if="stack.currentMuster !== undefined"
        class="recruited-creature"
      >
        <Creature
          :type="stack.currentMuster[0]"
          :player-id="stack.owner"
          in-svg
        />
      </g>
    </transition>
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { MasterboardPhase, Path, TitanGame } from "@/models/game"
import masterboard, { HexEdge, MasterboardEdge, MasterboardHex, Terrain } from "@/models/masterboard"
import { Moveable } from "@/models/moveable"
import { Stack } from "@/models/stack"
import { useGameStore } from "~/stores/game"
import { usePreferencesStore } from "~/stores/ui/preferences"
import { useSelectionStore } from "~/stores/ui/selection"
import { useSplitStagingStore } from "~/stores/ui/splitStaging"
import { Transformation, Transformations, TransformationType } from "~/utils/svg"
import EngageIcon from "../../ui/game/EngageIcon.vue"
import Creature from "../Creature.vue"
import PlayerMarker from "../Marker.vue"
import { hexTransform, isHexInverted } from "./utils"

const getEngageTransformForEdge = (hexId: number, edge: HexEdge): Transformations => {
  // Computed in hexId's own local frame, before hexTransform's sector rotation composes on
  // top; the extra 180 undoes HexShape.vue's 180-degree rotation of inverted hexes.
  const rotation = edge * 120 + 60 + (isHexInverted(hexId) ? 0 : 180)
  const transforms = new Transformations()
  transforms.push(new Transformation(TransformationType.ROTATE, [rotation]))
  transforms.push(new Transformation(TransformationType.TRANSLATE, [0, edge === HexEdge.SECOND ? 50 : 60]))
  transforms.push(new Transformation(TransformationType.SCALE, [0.75]))
  return transforms
}

const props = defineProps<{
  stack: Stack
  paths: Path[]
}>()

const emit = defineEmits<{
  enter: [stack: Stack]
  leave: [stack: Stack]
}>()

const gameStore = useGameStore()
const game = gameStore.game
const selectionStore = useSelectionStore()
const preferencesStore = usePreferencesStore()
const splitStagingStore = useSplitStagingStore()

const selected = computed(() => props.stack === selectionStore.selectedStack)

const stacksOnHex = computed((): Stack[] => TitanGame.getStacksForHex(game, props.stack.hex))

const stacksOnHexIndex = computed((): number => stacksOnHex.value.indexOf(props.stack))

const transform = computed((): string => {
  const result = hexTransform(props.stack.hex)
  result.push(new Transformation(TransformationType.TRANSLATE, [0, isHexInverted(props.stack.hex) ? -12 : 13]))
  if (stacksOnHex.value.length > 1) {
    result.push(new Transformation(TransformationType.ROTATE, [15 + 35 * stacksOnHexIndex.value]))
  }
  if (selected.value) {
    result.push(new Transformation(TransformationType.TRANSLATE, [2, -4]))
  } else {
    result.push(new Transformation(TransformationType.TRANSLATE, [0, -1 * props.stack.creatures.length]))
  }
  result.push(new Transformation(TransformationType.SCALE, [0.48]))
  return result.toString()
})

const isActivePlayer = computed(() => game.activePlayerId === props.stack.owner)

const stagedSplit = computed((): number[] => splitStagingStore.splittingIndices(props.stack.id))

const potentialEngagements = computed((): HexEdge[] => {
  if (selectionStore.selectedStack === undefined) {
    return []
  } else if (!TitanGame.isMovePhase(game)) {
    return []
  } else if (
    TitanGame.getStacksForHex(game, props.stack.hex).some((stack: Stack) => stack.owner === game.activePlayerId)
  ) {
    return []
  } else if (TitanGame.canTitanTeleport(game, selectionStore.selectedStack) || preferencesStore.freeMovement) {
    if (masterboard.getHex(props.stack.hex).terrain === Terrain.TOWER) {
      // Battle.create normalizes all Tower attacks to this edge regardless of
      // arrival direction.
      return [HexEdge.SECOND]
    }
    return [HexEdge.FIRST, HexEdge.SECOND, HexEdge.THIRD]
  } else {
    // For paths where this stack is the enemy...
    return props.paths
      .filter((path: Path) => path.foe === props.stack)
      .flatMap(({ path }: Path) =>
        // Find the index on the path where this stack resides...
        path.map((hex: MasterboardHex, i: number) =>
          hex.id === props.stack.hex
            ? // Figure out where the stack would enter this hex from
              hex.getEdges().find((edge: MasterboardEdge) => edge.hex.id === path[i - 1].id)?.hexEdge
            : undefined,
        ),
      )
      .filter((item?: HexEdge) => item !== undefined)
  }
})

const engageable = computed((): [HexEdge, Transformations][] =>
  potentialEngagements.value.map(edge => [edge, getEngageTransformForEdge(props.stack.hex, edge)]),
)

const engaged = computed(
  (): boolean =>
    isActivePlayer.value &&
    TitanGame.getStacksForHex(game, props.stack.hex).some((stack: Stack) => stack.owner !== game.activePlayerId),
)

const isMandatory = computed(() => {
  if (!isActivePlayer.value) {
    return false
  }
  switch (game.activePhase) {
    case MasterboardPhase.SPLIT:
      return !Stack.isValidSplit(props.stack, stagedSplit.value, game.round === 0)
    case MasterboardPhase.MOVE:
      return gameStore.mandatoryMoves.includes(props.stack)
  }
  return false
})

const classes = computed(() => ({
  selected: selected.value,
  owned: isActivePlayer.value,
  mandatory: isMandatory.value,
  disabled: !TitanGame.isStackActive(game, props.stack),
  engageable: engageable.value.length > 0,
  engaged: engaged.value,
  [`player-${props.stack.owner}`]: true,
  "multiple-stacks": stacksOnHex.value.length > 1,
  [`stack-on-hex-${stacksOnHexIndex.value}`]: true,
  [`phase-${MasterboardPhase[game.activePhase].toLowerCase()}`]: true,
}))

const stackSize = computed((): string => {
  const splitting = stagedSplit.value.length
  if (splitting > 0) {
    return `${props.stack.creatures.length - splitting} / ${splitting}`
  }
  return `${props.stack.creatures.length}`
})

function select(): void {
  if (!isActivePlayer.value) {
    return
  }
  if (TitanGame.isMovePhase(game) && Moveable.hasMoved(props.stack)) {
    if (!TitanGame.getStacksForHex(game, props.stack.initialHex).some((stack: Stack) => Moveable.hasMoved(stack))) {
      TitanGame.move(game, { stack: props.stack.id, hex: props.stack.initialHex })
    }
  }
  if (selected.value) {
    selectionStore.deselectStack()
  } else {
    if (TitanGame.isStackActive(game, props.stack)) {
      selectionStore.selectStack(props.stack)
    }
  }
}

function attack(edge: HexEdge): void {
  TitanGame.move(game, { stack: selectionStore.requireSelectedStack().id, hex: props.stack.hex, edge })
  selectionStore.deselectStack()
}

function enter(): void {
  emit("enter", props.stack)
  selectionStore.enterHex(masterboard.getHex(props.stack.hex))
}

function leave(): void {
  emit("leave", props.stack)
  selectionStore.leaveHex(masterboard.getHex(props.stack.hex))
}
</script>

<style lang="sass" scoped>
.creature
  fill: rgb(var(--v-theme-titan-white))
  stroke-width: 0.5px
  stroke: #353535
  transition: 0.2s ease-out

.marker
  transition: 0.2s ease-out

.owned:not(.disabled), .phase-move .owned
  cursor: grab

.mandatory
  filter: drop-shadow(0 0 4px #ec2c32)

.selected
  filter: drop-shadow(-4px 4px 6px #222222)

.owned.selected
  cursor: grabbing

.disabled
  filter: brightness(50%)

.annotation
  font-family: "Eczar", serif
  font-weight: 800
  font-size: 30pt
  fill: rgb(var(--v-theme-primary))
  text-shadow: 2px 2px black

.stack-size
  text-anchor: end

.stack-count
  fill: rgb(var(--v-theme-secondary))
  font-size: 30pt
  text-anchor: middle
  dominant-baseline: central

.engage-graphic
  fill: #e5051e
  stroke: black
  stroke-width: 0.75px
  transform: scale(3) translate(-12px, -12px)
  transition: all 0.25s

.marker:hover:not(.engaged) .engage-graphic
  transform: scale(4) translate(-12px, -12px)

.recruited-creature
  transform: rotate(25deg) scale(0.85)
  opacity: 1
  transition: transform 0.25s ease-out, opacity 0.2s

  &:hover
    opacity: 0.25

.muster-enter-active, .muster-leave-active
  transform: rotate(25deg) scale(0.85)

.muster-enter-from, .muster-leave-to
  opacity: 0
  transform: rotate(0) scale(1)
</style>
