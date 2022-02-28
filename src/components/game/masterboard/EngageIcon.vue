<template>
  <g class="engage-icon-root">
    <g class="engage-icon-container" :class="{ interactive }">
      <rect v-if="interactive" width="24" height="24" class="interaction-target" />
      <!-- sword-cross from Material Design Icons -->
      <path
        class="engage-graphic"
        d="M6.2,2.44L18.1,14.34L20.22,12.22L21.63,13.63L19.16,16.1L22.34,19.28C22.73,19.67 22.73,20.3 22.34,20.69L21.63,21.4C21.24,21.79 20.61,21.79 20.22,21.4L17,18.23L14.56,20.7L13.15,19.29L15.27,17.17L3.37,5.27V2.44H6.2M15.89,10L20.63,5.26V2.44H17.8L13.06,7.18L15.89,10M10.94,15L8.11,12.13L5.9,14.34L3.78,12.22L2.37,13.63L4.84,16.1L1.66,19.29C1.27,19.68 1.27,20.31 1.66,20.7L2.37,21.41C2.76,21.8 3.39,21.8 3.78,21.41L7,18.23L9.44,20.7L10.85,19.29L8.73,17.17L10.94,15Z"
      />
    </g>
  </g>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"

export default defineComponent({
  name: "EngageIcon",
  props: {
    interactive: {
      type: Boolean,
      required: false,
      default: false
    }
  }
})
</script>

<style lang="sass" scoped>
.engage-icon-container
  transform: scale(3) translate(-12px, -12px)
  transition: all 0.25s

.engage-graphic
  fill: #e5051e
  stroke: black
  stroke-width: 0.75px

.interaction-target
  fill: transparent

.interactive
  cursor: pointer

.engage-icon-container.interactive:hover
  transform: scale(4) translate(-12px, -12px)
</style>
