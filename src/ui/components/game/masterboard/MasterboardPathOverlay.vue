<template>
  <g
    :class="rootClass"
    :transform="transform"
    class="parent path"
    @mouseenter="selectionStore.enterHex(hex)"
    @mouseleave="selectionStore.leaveHex(hex)"
  >
    <polygon
      :class="{ fancy: preferencesStore.fancyGraphics }"
      :points="HEX_POINTS"
      :transform="inverted ? 'rotate(180)' : ''"
      class="hex"
    />
    <text
      :y="inverted ? -10 : 20"
      class="label"
      text-anchor="middle"
    >
      {{ pathStepLabel }}
    </text>
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { MasterboardHex } from "@/models/masterboard"
import { usePreferencesStore } from "~/stores/ui/preferences"
import { useSelectionStore } from "~/stores/ui/selection"
import { HEX_POINTS, hexTransform, isHexInverted } from "./utils"

// pathLength and positionOnPath are the roll length and this step's zero-based
// offset along the path; pathStepLabel is derived from them below
// (distanceToDest is derived inline in rootClass). They only ever appear
// together, so they're grouped into a single required prop.
export interface PathInfo {
  pathLength: number
  positionOnPath: number
  pathIndex: number
  containsEnemy: boolean
}

const props = defineProps<{
  hex: MasterboardHex
  pathInfo: PathInfo
}>()

const preferencesStore = usePreferencesStore()
const selectionStore = useSelectionStore()

const pathStepLabel = computed(() => props.pathInfo.positionOnPath + 1)

const rootClass = computed(() => {
  const { pathLength, positionOnPath, pathIndex, containsEnemy } = props.pathInfo
  const distanceToDest = pathLength - positionOnPath
  return {
    foe: containsEnemy,
    [`distance-${distanceToDest}`]: true,
    [`path-${pathIndex}`]: true,
    destination: distanceToDest === 1
  }
})

const transform = computed((): string => hexTransform(props.hex.id).toString())

const inverted = computed(() => isHexInverted(props.hex.id))
</script>

<style lang="sass" scoped>
.parent
  font-family: Quintessential, "Fanwood Text", serif
  font-weight: bold
  font-size: 0.75em
  text-transform: uppercase

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
