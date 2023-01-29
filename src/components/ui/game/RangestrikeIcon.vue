<template>
  <g class="rangestrike-icon-root">
    <g class="rangestrike-icon-container" :class="{ interactive, transparentHover, longDistance }">
      <rect v-if="interactive" width="24" height="24" class="interaction-target" />
      <!-- bow-arrow from Material Design Icons -->
      <path
        class="rangestrike-graphic"
        d="M19.03 6.03L20 7L22 2L17 4L17.97 4.97L16.15 6.79C10.87 2.16 3.3 3.94 2.97 4L2 4.26L2.5 6.2L3.29 6L10.12 12.82L6.94 16H5L2 19L4 20L5 22L8 19V17.06L11.18 13.88L18 20.71L17.81 21.5L19.74 22L20 21.03C20.06 20.7 21.84 13.13 17.21 7.85L19.03 6.03M4.5 5.78C6.55 5.5 11.28 5.28 14.73 8.21L10.82 12.12L4.5 5.78M18.22 19.5L11.88 13.18L15.79 9.27C18.72 12.72 18.5 17.45 18.22 19.5Z"
      />
      <text
        v-if="totalAdjustment !== 0"
        class="rangestrike-graphic"
        x="7"
        y="28"
        v-text="totalAdjustment"
      />
    </g>
  </g>
</template>

<script lang="ts">
import { defineComponent, PropType } from "@vue/runtime-core"
import { Strike } from "~/models/battle"

export default defineComponent({
  name: "RangestrikeIcon",
  props: {
    interactive: {
      type: Boolean,
      required: false,
      default: false
    },
    transparentHover: {
      type: Boolean,
      required: false,
      default: false
    },
    longDistance: {
      type: Boolean,
      required: false,
      default: false
    },
    adjustment: {
      type: Object as PropType<Strike>,
      required: false,
      default: undefined
    }
  },
  computed: {
    totalAdjustment() {
      return 0 // Disable this for now // this.adjustment + (this.longDistance ? -1 : 0)
    }
  }
})
</script>

<style lang="sass" scoped>
.rangestrike-icon-container
  transform: scale(3) translate(-12px, -12px)
  opacity: 1
  transition: all 0.25s

  text
    font-size: 0.6em
    stroke-width: 0.5px

.rangestrike-graphic
  fill: #e5051e
  stroke: black
  stroke-width: 0.75px

.interaction-target
  fill: transparent

.interactive
  cursor: pointer

.rangestrike-icon-container.interactive:hover
  transform: scale(4) translate(-12px, -12px)

.rangestrike-icon-container.transparentHover:hover
  opacity: 0.2

.rangestrike-icon-container.longDistance .rangestrike-graphic
  fill: #a52a04
</style>
