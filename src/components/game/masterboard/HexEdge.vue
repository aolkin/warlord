<template>
  <g :class="classes" :transform="hexTransform">
    <rect
      v-for="x in shadowMaskXs"
      :key="x"
      :transform="transform"
      :x="x"
      class="shadow-mask"
      height="8"
      width="8"
      y="-10"
    />
    <g v-if="edge.rule === MovementRule.SQUARE" :transform="transform">
      <polyline points="-4,-4 -4,4 4,4 4,-4" />
    </g>
    <g v-else-if="edge.rule === MovementRule.CIRCLE" :transform="transform">
      <path d="M4,-4 v4 a4,4 0 1,1 -8,0 v-4" fill-rule="nonzero" />
    </g>
    <g v-else-if="edge.rule === MovementRule.ARROW && multiArrow" :transform="transform">
      <polyline points="-24,-3.25 -20,3 -16,-3.25" />
      <polyline points="-14,-3.25 -10,3  -6,-3.25" />
      <polyline points=" -4,-3.25   0,3   4,-3.25" />
      <polyline v-if="shadows" class="no-shadow" points="-16.5,-3.25, -13.5,-3.25" />
      <polyline v-if="shadows" class="no-shadow" points="-26.5,-3.25, -23.5,-3.25" />
    </g>
    <g v-else :transform="transform">
      <polyline points="-4,-4 0,3 4,-4" />
    </g>
    <g v-if="shadows" :transform="transform">
      <polyline class="no-shadow" points="-6.5,-3.25, -3.5,-3.25" />
      <polyline class="no-shadow" points="3.5,-3.25, 6.5,-3.25" />
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
    },
    shadow: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      MovementRule
    }
  },
  computed: {
    multiArrow(): boolean {
      return this.edge.rule === MovementRule.ARROW &&
        !this.edge.hex.getEdges().some(edge =>
          edge.rule !== MovementRule.NONE && edge.hex.id === this.hex.id)
    },
    hexTransform() {
      return hexTransform(this.hex.id)
    },
    transform() {
      return `rotate(${isHexInverted(this.hex.id) ? 180 : 0})
              translate(0 10)
              rotate(${(this.edge.hexEdge - 1) * 120})
              translate(${this.edge.hexEdge === 1 ? 10 : (this.edge.hexEdge === 0 ? 6 : 14)} 0)
              translate(0 ${TRIANGLE_HEIGHT / 4 + (this.edge.hexEdge === 1 ? 13.75 : 7.25)})`
    },
    classes() {
      return {
        [Terrain[this.hex.terrain].toLowerCase()]: true,
        ["to-" + Terrain[this.edge.hex.terrain].toLowerCase()]: true,
        root: !this.shadow,
        shadow: this.shadow
      }
    },
    shadowMaskXs() {
      return this.shadow ? (this.multiArrow ? [-4, -14, -24] : [-4]) : []
    },
    shadows(): boolean {
      return this.$store.state.ui.preferences.fancyGraphics
    }
  }
})
</script>

<style lang="sass" scoped>
@import "@/styles/terrain-colors.sass"

.root > g, .shadow > g
  fill: transparent
  stroke: white
  stroke-width: 1.5px

.shadow path, .shadow polyline:not(.no-shadow)
  filter: drop-shadow(0px 0px 1px #000000aa)

polyline.no-shadow
  stroke-width: 1.25px

.shadow-mask
  stroke-width: 0px
  filter: blur(1px)

@include terrain-colors("&.root polyline, &.root path, &.shadow rect.shadow-mask", fill)
</style>
