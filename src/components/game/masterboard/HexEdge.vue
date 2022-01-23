<template>
  <g :class="classes" :transform="hexTransform" class="root">
    <g v-if="edge.rule === MovementRule.SQUARE" :transform="transform">
      <polyline points="-4,-4 -4,4 4,4 4,-4" />
    </g>
    <g v-else-if="edge.rule === MovementRule.CIRCLE" :transform="transform">
      <path d="M4,-4 v4 a4,4 0 1,1 -8,0 v-4" fill-rule="nonzero" />
    </g>
    <g v-else-if="edge.rule === MovementRule.ARROW && singleArrow" :transform="transform">
      <polyline points="-4,-4 0,3 4,-4" />
    </g>
    <g v-else :transform="transform">
      <polyline points="-4,-4 0,3 4,-4" />
      <polyline points="-24,-4 -20,3 -16,-4" />
      <polyline points="-14,-4 -10,3 -6,-4" />
    </g>
  </g>
</template>
<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { MasterboardEdge, MasterboardHex, MovementRule, Terrain } from "~/models/masterboard"
import { hexTransform, isHexInverted, TRIANGLE_HEIGHT } from "./utils"

export default defineComponent({
  name: "HexEdge",
  props: {
    edge: {
      type: Object as () => MasterboardEdge,
      required: true
    },
    hex: {
      type: MasterboardHex,
      required: true
    }
  },
  data () {
    return {
      MovementRule
    }
  },
  computed: {
    singleArrow (): boolean {
      return this.edge.hex.edges.some(edge => edge.hex.id === this.hex.id)
    },
    hexTransform () {
      return hexTransform(this.hex)
    },
    transform () {
      return `rotate(${isHexInverted(this.hex) ? 180 : 0})
              translate(0 10)
              rotate(${(this.edge.hexEdge - 1) * 120})
              translate(${this.edge.hexEdge === 1 ? 10 : (this.edge.hexEdge === 0 ? 6 : 14)} 0)
              translate(0 ${TRIANGLE_HEIGHT / 4 + (this.edge.hexEdge === 1 ? 14.75 : 8)})`
    },
    classes () {
      return {
        [Terrain[this.hex.terrain].toLowerCase()]: true,
        ["to-" + Terrain[this.edge.hex.terrain].toLowerCase()]: true
      }
    }
  }
})
</script>

<style lang="sass" scoped>
@import "@/styles/terrain-colors.sass"

.root
  fill: transparent
  stroke: white
  stroke-width: 2px

.root, .root *
  z-index: 999

@include terrain-colors("&.root polyline, &.root path", fill)
</style>
