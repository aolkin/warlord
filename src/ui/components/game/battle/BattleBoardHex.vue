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
    <image
      v-for="(edge, index) in edgeHazards"
      :key="index"
      :href="edgeHazardImg(edge)"
      width="100"
      height="116"
      x="-50"
      y="-58"
      class="edge-hazard"
      :class="`edge-hazard-${index}`"
    />
    <polygon
      v-if="interactive"
      class="highlight-border"
      points="-50,-29 -50,29 0,58 50,29 50,-29 0,-58 "
    />
  </g>
</template>
<script setup lang="ts">
import { computed } from "vue"
import { EdgeHazard, Hazard } from "@/models/battle"

const props = withDefaults(defineProps<{
  elevation?: number
  hazard?: Hazard
  edgeHazards: Record<number, EdgeHazard>
  interactive?: boolean
}>(), {
  elevation: 0,
  hazard: Hazard.NONE,
  interactive: false
})

const hexClasses = computed(() => ({
  [`elevation-${props.elevation}`]: true,
  [Hazard[props.hazard].toLowerCase()]: true
}))

const hazardImg = computed(() => new URL(`../../../assets/hazards/${Hazard[props.hazard].toLowerCase()}.svg`,
  import.meta.url).href)

const edgeHazardImg = computed(() => (hazard: EdgeHazard) =>
  new URL(`../../../assets/hazards/${EdgeHazard[hazard].toLowerCase()}.svg`,
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

@for $i from 0 through 5
  .edge-hazard-#{$i}
    transform: rotate($i * 60deg) scale(1.04) translate(-14.5px, -24.5px)

.highlight-border
  fill: transparent
  stroke: rgb(var(--v-theme-primary))
  stroke-width: 10px
  transform: scale(0.98)
</style>
