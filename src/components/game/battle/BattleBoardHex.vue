<template>
  <g>
    <polygon class="hex" :class="hexClasses" points="-50,-29 -50,29 0,58 50,29 50,-29 0,-58 " />
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
  </g>
</template>
<script lang="ts">
import { defineComponent, PropType } from "@vue/runtime-core"
import { EdgeHazard, Hazard } from "~/models/battle"

export default defineComponent({
  name: "BattleBoardHex",
  props: {
    elevation: {
      type: Number,
      default: 0
    },
    hazard: {
      type: Number as PropType<Hazard>,
      default: Hazard.NONE
    },
    edgeHazards: {
      type: Object as PropType<Record<number, EdgeHazard>>,
      default: () => {}
    }
  },
  computed: {
    hexClasses() {
      return {
        [`elevation-${this.elevation}`]: true,
        [Hazard[this.hazard].toLowerCase()]: true
      }
    },
    hazardImg() {
      return new URL(`../../../assets/hazards/${Hazard[this.hazard].toLowerCase()}.svg`,
        import.meta.url).href
    },
    edgeHazardImg(): ((hazard: EdgeHazard) => string) {
      return (hazard: EdgeHazard) =>
        new URL(`../../../assets/hazards/${EdgeHazard[hazard].toLowerCase()}.svg`,
          import.meta.url).href
    }
  }
})
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
    transform: rotate($i * 60deg) scale(1.03) translate(-15.5px, -24px)
</style>
