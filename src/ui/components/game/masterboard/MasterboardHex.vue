<template>
  <g
    :class="terrain"
    :transform="transform"
    class="parent board"
    @mouseenter="selectionStore.enterHex(hex)"
    @mouseleave="selectionStore.leaveHex(hex)"
  >
    <polygon
      :class="{ fancy: preferencesStore.fancyGraphics }"
      :points="HEX_POINTS"
      :transform="inverted ? 'rotate(180)' : ''"
      class="hex"
    />
    <clipPath
      v-if="preferencesStore.fancyGraphics"
      :id="`hex-${hex.id}-clip`"
    >
      <polygon
        :points="HEX_POINTS"
      />
    </clipPath>
    <polygon
      v-if="preferencesStore.fancyGraphics"
      :clip-path="`url(#hex-${hex.id}-clip)`"
      :points="HEX_POINTS"
      :transform="inverted ? 'rotate(180) scale(0.99)' : 'scale(0.99)'"
      class="outline"
    />
    <text
      :y="inverted ? 15 : -10"
      class="id"
      text-anchor="middle"
    >
      {{ hex.id }}
    </text>
    <text
      :y="inverted ? -25 : 35"
      class="label"
      text-anchor="middle"
    >
      {{ terrain }}
    </text>
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { MasterboardHex, Terrain } from "@/models/masterboard"
import { usePreferencesStore } from "~/stores/ui/preferences"
import { useSelectionStore } from "~/stores/ui/selection"
import { HEX_POINTS, hexTransform, isHexInverted } from "./utils"

const props = defineProps<{
  hex: MasterboardHex
}>()

const preferencesStore = usePreferencesStore()
const selectionStore = useSelectionStore()

const terrain = computed(() => Terrain[props.hex?.terrain].toLowerCase())

const transform = computed((): string => hexTransform(props.hex.id).toString())

const inverted = computed(() => isHexInverted(props.hex.id))
</script>

<style lang="sass" scoped>
@import "~/styles/terrain-colors.sass"

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
</style>
