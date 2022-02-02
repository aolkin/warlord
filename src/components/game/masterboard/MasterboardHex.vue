<template>
  <g
    :class="rootClass"
    :transform="transform"
    class="parent"
    @mouseenter="enter"
    @mouseleave="leave"
  >
    <polygon
      :class="{ fancy: shadows }"
      :points="points.join(' ')"
      :transform="inverted ? 'rotate(180)' : ''"
      class="hex"
    />
    <template v-if="!path">
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
      <text :y="inverted ? 15 : -10" class="id" text-anchor="middle" v-text="hex.id" />
      <text :y="inverted ? -25 : 35" class="label" text-anchor="middle" v-text="terrain" />
    </template>
    <template v-else>
      <text :y="inverted ? -10 : 20" class="label" text-anchor="middle" v-text="pathCount" />
    </template>
  </g>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapMutations, mapState } from "vuex"
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
    },
    distanceToDest: {
      type: Number,
      required: false,
      default: undefined
    },
    pathIndex: {
      type: Number,
      required: false,
      default: 0
    },
    containsEnemy: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  computed: {
    ...mapState("game", ["activeRoll"]),
    ...mapState("ui/preferences", {
      shadows: state => state.fancyGraphics
    }),
    rootClass() {
      if (this.path) {
        return {
          path: true,
          foe: this.containsEnemy,
          [`distance-${this.distanceToDest}`]: true,
          [`path-${this.pathIndex}`]: true,
          destination: this.distanceToDest === 1
        }
      } else {
        return {
          board: true,
          [this.terrain]: true
        }
      }
    },
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
    path(): boolean {
      return this.distanceToDest !== undefined
    },
    pathCount(): number {
      return this.activeRoll - this.distanceToDest + 1
    }
  },
  methods: {
    ...mapMutations("ui/selections", ["enterHex", "leaveHex"]),
    enter() {
      this.enterHex(this.hex)
    },
    leave() {
      this.leaveHex(this.hex)
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
    $dist-opacity: calc(1 - $dist / 6 * 0.5)

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
