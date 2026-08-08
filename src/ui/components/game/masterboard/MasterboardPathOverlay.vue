<template>
  <HexShape
    :class="rootClass"
    :hex="hex"
  >
    <template #default="{ inverted }">
      <text
        :y="inverted ? -10 : 20"
        class="label"
        text-anchor="middle"
      >
        {{ pathStepLabel }}
      </text>
    </template>
  </HexShape>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { MasterboardHex } from "@/models/masterboard"
import HexShape from "./HexShape.vue"

const props = defineProps<{
  hex: MasterboardHex
  pathLength: number
  positionOnPath: number
  pathIndex: number
  containsEnemy: boolean
}>()

const pathStepLabel = computed(() => props.positionOnPath + 1)

const rootClass = computed(() => {
  const distanceToDest = props.pathLength - props.positionOnPath
  return {
    foe: props.containsEnemy,
    [`distance-${distanceToDest}`]: true,
    [`path-${props.pathIndex}`]: true,
    destination: pathStepLabel.value === props.pathLength
  }
})
</script>

<style lang="sass" scoped>
:deep(.hex)
  stroke-width: 0
  transition: 0.25s ease-out

.label
  font-size: 20pt

@for $path from 0 through 2
  $path-color: adjust-hue(#ff43ab, $path * 120deg)

  @for $dist from 1 through 6
    $dist-opacity: calc(0.75 - $dist / 6 * 0.5)

    .path-#{$path}.distance-#{$dist}
      :deep(.hex)
        fill: rgba($path-color, $dist-opacity)
        stroke: darken($path-color, 25%)

      .label
        fill: darken($path-color, 35%)

      &:hover :deep(.hex)
        fill: rgba($path-color, 0.25)

g.paths:hover .root
  .label
    opacity: 0.2

  :deep(.hex)
    fill: transparent

  &:hover
    .label
      opacity: 1

    :deep(.hex)
      stroke-width: 2px

.distance-1:not(.foe)
  cursor: pointer

  &:hover :deep(.hex)
    stroke-width: 8px !important
</style>
