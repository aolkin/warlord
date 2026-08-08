<template>
  <g>
    <polygon
      class="hex"
      :class="hexClasses"
      points="-50,-29 -50,29 0,58 50,29 50,-29 0,-58 "
    />
    <image
      v-if="hazard !== 0"
      :href="hazardImg"
      width="100"
      height="116"
      x="-50"
      y="-58"
    />
  </g>
</template>
<script setup lang="ts">
import { computed } from "vue"
import { EdgeHazard, Hazard } from "@/models/battle"

const props = withDefaults(defineProps<{
  elevation?: number
  hazard?: Hazard
  edgeHazards?: Record<number, EdgeHazard>
}>(), {
  elevation: 0,
  hazard: Hazard.NONE
})

const hexClasses = computed(() => ({
  [`elevation-${props.elevation}`]: true,
  [Hazard[props.hazard].toLowerCase()]: true
}))

const hazardImg = computed(() => new URL(`../../../assets/hazards/${Hazard[props.hazard].toLowerCase()}.svg`,
  import.meta.url).href)
</script>

<style lang="sass" scoped>
.hex
  stroke: black
  stroke-width: 5px
  stroke-linejoin: round

.hex.elevation-0
  filter: saturate(50%) brightness(200%)
.hex.elevation-1
  filter: saturate(35%) brightness(250%)
.hex.elevation-2
  filter: saturate(20%) brightness(300%)
</style>
