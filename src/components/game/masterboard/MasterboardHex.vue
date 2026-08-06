<template>
  <g
    :class="rootClass"
    :transform="transform"
    class="parent"
    @mouseenter="enter"
    @mouseleave="leave"
  >
    <polygon
      :class="{ fancy: preferencesStore.fancyGraphics }"
      :points="points.join(' ')"
      :transform="inverted ? 'rotate(180)' : ''"
      class="hex"
    />
    <template v-if="!path">
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
        {{ pathCount }}
      </text>
    </template>
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { MasterboardHex, Terrain } from "~/models/masterboard"
import { useTypedStore } from "~/plugins/vuex"
import { useSelectionStore } from "~/stores/selection"
import { usePreferencesStore } from "~/stores/ui/preferences"
import {
  CLIP_TRIANGLE_HEIGHT,
  CLIP_TRIANGLE_SIDE,
  hexTransform,
  isHexInverted,
  TRIANGLE_HEIGHT,
  TRIANGLE_SIDE
} from "./utils"

const props = withDefaults(defineProps<{
  hex: MasterboardHex
  distanceToDest?: number
  pathIndex?: number
  containsEnemy?: boolean
}>(), {
  distanceToDest: undefined,
  pathIndex: 0,
  containsEnemy: false
})

const preferencesStore = usePreferencesStore()
const selectionStore = useSelectionStore()
const store = useTypedStore()

const terrain = computed(() => Terrain[props.hex?.terrain].toLowerCase())

const path = computed((): boolean => props.distanceToDest !== undefined)

const rootClass = computed(() => {
  if (path.value) {
    return {
      path: true,
      foe: props.containsEnemy,
      [`distance-${props.distanceToDest}`]: true,
      [`path-${props.pathIndex}`]: true,
      destination: props.distanceToDest === 1
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

// Only read in the "path" branch (path === true), which only occurs when this
// hex was given a distanceToDest by Masterboard's path rendering, itself only
// populated once the selection store's "paths" getter is non-empty and therefore
// activeRoll is defined - see src/stores/selection.ts.
const pathCount = computed((): number =>
  store.state.game.activeRoll! - (props.distanceToDest ?? 0) + 1)

function enter(): void {
  selectionStore.enterHex(props.hex)
}

function leave(): void {
  selectionStore.leaveHex(props.hex)
}
</script>

<style lang="sass" scoped>
@import "@/styles/terrain-colors.sass"

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
