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
          :player="stackPlayer"
          in-svg
        />
      </g>
    </transition>
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { CreatureType } from "@/models/creature"
import { MasterboardPhase, Path } from "@/models/game"
import masterboard, { HexEdge, MasterboardEdge, MasterboardHex } from "@/models/masterboard"
import { Player } from "@/models/player"
import { Stack } from "@/models/stack"
import { useTypedStore } from "~/plugins/vuex"
import { useSelectionStore } from "~/stores/ui/selection"
import { Transformation, Transformations, TransformationType } from "~/utils/svg"
import EngageIcon from "../../ui/game/EngageIcon.vue"
import Creature from "../Creature.vue"
import PlayerMarker from "../Marker.vue"
import { hexTransform, isHexInverted } from "./utils"

const getEngageTransformForEdge = (edge: HexEdge): Transformations => {
  const transforms = new Transformations()
  transforms.push(new Transformation(TransformationType.ROTATE, [edge * 120 + 60]))
  transforms.push(new Transformation(TransformationType.TRANSLATE,
    [0, edge === HexEdge.SECOND ? 50 : 60]))
  transforms.push(new Transformation(TransformationType.SCALE, [0.75]))
  return transforms
}

const props = defineProps<{
  stack: Stack
}>()

const selectionStore = useSelectionStore()
const store = useTypedStore()

const activePhase = computed(() => store.state.game.activePhase)
const activeRoll = computed(() => store.state.game.activeRoll)
const activePlayerId = computed(() => store.getters["game/activePlayerId"])
const activePlayer = computed(() => store.getters["game/activePlayer"])
const mandatoryMoves = computed((): Stack[] => store.getters["game/mandatoryMoves"])
const stacksForHex = computed(() => store.getters["game/stacksForHex"])
const firstRound = computed(() => store.getters["game/firstRound"])
const playerById = computed(() => store.getters["game/playerById"])

const selected = computed(() => props.stack === selectionStore.selectedStack)

const stacksOnHex = computed((): Stack[] => stacksForHex.value(props.stack.hex))

const stacksOnHexIndex = computed((): number => stacksOnHex.value.indexOf(props.stack))

const transform = computed((): string => {
  const result = hexTransform(props.stack.hex)
  result.push(new Transformation(TransformationType.TRANSLATE,
    [0, isHexInverted(props.stack.hex) ? -12 : 13]))
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

const isActivePlayer = computed(() => activePlayerId.value === props.stack.owner)

const stackPlayer = computed((): Player => playerById.value(props.stack.owner))

const potentialEngagements = computed((): HexEdge[] => {
  if (selectionStore.selectedStack === undefined) {
    return []
  } else if (stacksForHex.value(props.stack.hex)
    .some((stack: Stack) => stack.owner === activePlayerId.value)) {
    return []
  } else if (activeRoll.value === 6 && activePlayer.value.score >= 400 &&
    selectionStore.selectedStack.creatures.includes(CreatureType.TITAN)) {
    return [HexEdge.FIRST, HexEdge.SECOND, HexEdge.THIRD]
  } else {
    // For paths where this stack is the enemy...
    return selectionStore.paths.filter((path: Path) => path.foe === props.stack).flatMap(({ path }: Path) =>
      // Find the index on the path where this stack resides...
      path.map((hex: MasterboardHex, i: number) => hex.id === props.stack.hex
        // Figure out where the stack would enter this hex from
        ? hex.getEdges().find((edge: MasterboardEdge) => edge.hex.id === path[i - 1].id)?.hexEdge
        : undefined)
    ).filter((item?: HexEdge) => item !== undefined)
  }
})

const engageable = computed((): [HexEdge, Transformations][] =>
  potentialEngagements.value.map(edge => [edge, getEngageTransformForEdge(edge)]))

const engaged = computed((): boolean => isActivePlayer.value && stacksForHex.value(props.stack.hex)
  .some((stack: Stack) => stack.owner !== activePlayerId.value))

const isMandatory = computed(() => {
  if (!isActivePlayer.value) {
    return false
  }
  switch (activePhase.value) {
    case MasterboardPhase.SPLIT:
      return !props.stack.isValidSplit(firstRound.value)
    case MasterboardPhase.MOVE:
      return mandatoryMoves.value.includes(props.stack)
  }
  return false
})

const isDisabled = computed(() => {
  if (!isActivePlayer.value) {
    return false
  }
  switch (activePhase.value) {
    case MasterboardPhase.SPLIT:
      return props.stack.creatures.length < 4
    case MasterboardPhase.MOVE:
      return props.stack.hasMoved()
    case MasterboardPhase.MUSTER:
      return !props.stack.canMuster()
  }
  return false
})

const classes = computed(() => ({
  selected: selected.value,
  owned: isActivePlayer.value,
  mandatory: isMandatory.value,
  disabled: isDisabled.value,
  engageable: engageable.value.length > 0,
  engaged: engaged.value,
  [`player-${props.stack.owner}`]: true,
  "multiple-stacks": stacksOnHex.value.length > 1,
  [`stack-on-hex-${stacksOnHexIndex.value}`]: true,
  [`phase-${MasterboardPhase[activePhase.value].toLowerCase()}`]: true
}))

const stackSize = computed((): string => {
  if (props.stack.split.some(i => i)) {
    return `${props.stack.creatures.length - props.stack.numSplitting()} / ${props.stack.numSplitting()}`
  }
  return `${props.stack.creatures.length}`
})

function select(): void {
  if (!isActivePlayer.value) {
    return
  }
  if (activePhase.value === MasterboardPhase.MOVE && props.stack.hasMoved()) {
    if (!stacksForHex.value(props.stack.origin).some((stack: Stack) => stack.hasMoved())) {
      store.dispatch("game/move", { stack: props.stack, hex: props.stack.origin })
    }
  }
  if (selected.value) {
    selectionStore.deselectStack()
  } else {
    if (!isDisabled.value) {
      selectionStore.selectStack(props.stack)
    }
  }
}

function attack(edge: HexEdge): void {
  store.dispatch("game/move", { stack: selectionStore.selectedStack, hex: props.stack.hex, edge })
  selectionStore.deselectStack()
}

function enter(): void {
  selectionStore.enterStack(props.stack)
  selectionStore.enterHex(masterboard.getHex(props.stack.hex))
}

function leave(): void {
  selectionStore.leaveStack(props.stack)
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
