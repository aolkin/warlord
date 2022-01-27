<template>
  <g
    :class="terrain"
    :transform="transform"
    class="parent"
  >
    <polygon
      :class="{ fancy: shadows }"
      :points="points.join(' ')"
      :transform="inverted ? 'rotate(180)' : ''"
      class="hex"
    />
    <clipPath v-if="shadows" :id="`hex-${hex.id}-clip`">
      <polygon
        :points="points.join(' ')"
      />
    </clipPath>
    <polygon
      v-if="shadows"
      :clip-path="`url(#hex-${hex.id}-clip)`"
      :points="points.join(' ')"
      :transform="inverted ? 'rotate(180) scale(0.99)' : 'scale(0.99)'"
      class="outline"
    />
    <text :y="inverted ? 15 : -10" class="id" text-anchor="middle">{{ hex.id }}</text>
    <text :y="inverted ? -25 : 35" class="label" text-anchor="middle">{{ terrain }}</text>
  </g>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { MasterboardHex, Terrain } from "~/models/masterboard"
import {
  CLIP_TRIANGLE_HEIGHT,
  CLIP_TRIANGLE_SIDE,
  hexTransform,
  isHexInverted,
  TRIANGLE_HEIGHT,
  TRIANGLE_SIDE
} from "./utils"

export default defineComponent({
  name: "MasterboardHex",
  props: {
    hex: {
      type: MasterboardHex,
      required: true
    }
  },
  computed: {
    terrain() {
      return Terrain[this.hex?.terrain].toLowerCase()
    },
    viewBox() {
      return `-${TRIANGLE_SIDE / 2} -${TRIANGLE_HEIGHT / 2} ${TRIANGLE_SIDE} ${TRIANGLE_HEIGHT}`
    },
    points() {
      return [
        [-CLIP_TRIANGLE_SIDE / 2, CLIP_TRIANGLE_HEIGHT - TRIANGLE_HEIGHT / 2],
        [CLIP_TRIANGLE_SIDE / 2, CLIP_TRIANGLE_HEIGHT - TRIANGLE_HEIGHT / 2],
        [TRIANGLE_SIDE / 2 - CLIP_TRIANGLE_SIDE / 2, TRIANGLE_HEIGHT / 2 - CLIP_TRIANGLE_HEIGHT],
        [TRIANGLE_SIDE / 2 - CLIP_TRIANGLE_SIDE, TRIANGLE_HEIGHT / 2],
        [CLIP_TRIANGLE_SIDE - TRIANGLE_SIDE / 2, TRIANGLE_HEIGHT / 2],
        [CLIP_TRIANGLE_SIDE / 2 - TRIANGLE_SIDE / 2, TRIANGLE_HEIGHT / 2 - CLIP_TRIANGLE_HEIGHT]
      ].map(([x, y]) => `${x},${y}`)
    },
    transform() {
      return hexTransform(this.hex.id)
    },
    inverted() {
      return isHexInverted(this.hex.id)
    },
    shadows(): boolean {
      return this.$store.state.ui.preferences.fancyGraphics
    }
  }
})
</script>

<style lang="sass" scoped>
@import "@/styles/terrain-colors.sass"

.parent
  font-family: Quintessential, "Fanwood Text", serif
  font-weight: bold
  font-size: 0.75em
  text-transform: uppercase

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

.mountains
  .label
    font-size: 0.9em
    letter-spacing: -0.075em
    baseline-shift: 0.25em

@include terrain-colors(".hex", fill)
</style>
