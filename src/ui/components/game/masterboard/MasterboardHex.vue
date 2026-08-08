<template>
  <g
    :class="rootClass"
    :transform="transform"
    class="parent"
    @mouseenter="selectionStore.enterHex(hex)"
    @mouseleave="selectionStore.leaveHex(hex)"
  >
    <polygon
      :class="{ fancy: preferencesStore.fancyGraphics }"
      :points="points.join(' ')"
      :transform="inverted ? 'rotate(180)' : ''"
      class="hex"
    />
    <template v-if="!pathInfo">
      <clipPath
        v-if="preferencesStore.fancyGraphics"
        :id="`hex-${hex.id}-clip`"
      >
        <polygon
          :points="points.join(' ')"
        />
      </clipPath>
      <polygon
        v-if="preferencesStore.fancyGraphics"
        :clip-path="`url(#hex-${hex.id}-clip)`"
        :points="points.join(' ')"
        :transform="inverted ? 'rotate(180) scale(0.99)' : 'scale(0.99)'"
        class="outline"
      />
      <text
        :y="inverted ? 15 : -10"
        class="id"
        text-anchor="middle"
      >
        {{ hex.id }}
      </text>
      <text
        :y="inverted ? -25 : 35"
        class="label"
        text-anchor="middle"
      >
        {{ terrain }}
      </text>
    </template>
    <template v-else>
      <text
        :y="inverted ? -10 : 20"
        class="label"
        text-anchor="middle"
      >
        {{ distanceFromStart }}
      </text>
    </template>
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { MasterboardHex, Terrain } from "@/models/masterboard"
import { usePreferencesStore } from "~/stores/ui/preferences"
import { useSelectionStore } from "~/stores/ui/selection"
import {
  CLIP_TRIANGLE_HEIGHT,
  CLIP_TRIANGLE_SIDE,
  hexTransform,
  isHexInverted,
  TRIANGLE_HEIGHT,
  TRIANGLE_SIDE
} from "./utils"

// Populated only when this hex is a step on a stack's move path; its absence means
// the hex is being rendered as a plain board hex. pathLength and positionOnPath are
// the roll length and this step's zero-based offset along the path; distanceToDest
// and distanceFromStart are derived from them below.
export interface PathInfo {
  pathLength: number
  positionOnPath: number
  pathIndex: number
  containsEnemy: boolean
}

const props = defineProps<{
  hex: MasterboardHex
  pathInfo?: PathInfo
}>()

const preferencesStore = usePreferencesStore()
const selectionStore = useSelectionStore()

const terrain = computed(() => Terrain[props.hex?.terrain].toLowerCase())

const distanceToDest = computed(() => props.pathInfo!.pathLength - props.pathInfo!.positionOnPath)
const distanceFromStart = computed(() => props.pathInfo!.positionOnPath + 1)

const rootClass = computed(() => {
  if (props.pathInfo) {
    const { pathIndex, containsEnemy } = props.pathInfo
    return {
      path: true,
      foe: containsEnemy,
      [`distance-${distanceToDest.value}`]: true,
      [`path-${pathIndex}`]: true,
      destination: distanceToDest.value === 1
    }
  } else {
    return {
      board: true,
      [terrain.value]: true
    }
  }
})

const points = computed(() => [
  [-CLIP_TRIANGLE_SIDE / 2, CLIP_TRIANGLE_HEIGHT - TRIANGLE_HEIGHT / 2],
  [CLIP_TRIANGLE_SIDE / 2, CLIP_TRIANGLE_HEIGHT - TRIANGLE_HEIGHT / 2],
  [TRIANGLE_SIDE / 2 - CLIP_TRIANGLE_SIDE / 2, TRIANGLE_HEIGHT / 2 - CLIP_TRIANGLE_HEIGHT],
  [TRIANGLE_SIDE / 2 - CLIP_TRIANGLE_SIDE, TRIANGLE_HEIGHT / 2],
  [CLIP_TRIANGLE_SIDE - TRIANGLE_SIDE / 2, TRIANGLE_HEIGHT / 2],
  [CLIP_TRIANGLE_SIDE / 2 - TRIANGLE_SIDE / 2, TRIANGLE_HEIGHT / 2 - CLIP_TRIANGLE_HEIGHT]
].map(([x, y]) => `${x},${y}`))

const transform = computed((): string => hexTransform(props.hex.id).toString())

const inverted = computed(() => isHexInverted(props.hex.id))
</script>

<style lang="sass" scoped>
@import "~/styles/terrain-colors.sass"

.parent
  font-family: Quintessential, "Fanwood Text", serif
  font-weight: bold
  font-size: 0.75em
  text-transform: uppercase

.parent.board
  .id
    font-size: 0.6em
  .hex
    stroke: white
    stroke-width: 2px

  .hex.fancy
    stroke: black
    stroke-width: 1px

  .outline
    stroke: white
    stroke-width: 3px
    fill: transparent
    filter: drop-shadow(0px 0px 3px #000000bb)

  &.mountains
    .label
      font-size: 0.9em
      letter-spacing: -0.075em
      baseline-shift: 0.25em

@include terrain-colors(".hex", fill)

.path .hex
  stroke-width: 0
  transition: 0.25s ease-out

.path .label
  font-size: 20pt

@for $path from 0 through 2
  $path-color: adjust-hue(#ff43ab, $path * 120deg)

  @for $dist from 1 through 6
    $dist-opacity: calc(0.75 - $dist / 6 * 0.5)

    .path-#{$path}.distance-#{$dist}
      .hex
        fill: rgba($path-color, $dist-opacity)
        stroke: darken($path-color, 25%)

      .label
        fill: darken($path-color, 35%)

      &:hover .hex
        fill: rgba($path-color, 0.25)

g.paths:hover .path
  .label
    opacity: 0.2

  .hex
    fill: transparent

  &:hover
    .label
      opacity: 1

    .hex
      stroke-width: 2px

.path.distance-1:not(.foe)
  cursor: pointer

  &:hover .hex
    stroke-width: 8px !important

</style>
