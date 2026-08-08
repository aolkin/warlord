<template>
  <HexShape
    :class="terrain"
    :hex="hex"
  >
    <template #default="{ inverted }">
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
    </template>
  </HexShape>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { MasterboardHex, Terrain } from "@/models/masterboard"
import { usePreferencesStore } from "~/stores/ui/preferences"
import HexShape from "./HexShape.vue"
import { HEX_POINTS } from "./utils"

const props = defineProps<{
  hex: MasterboardHex
}>()

const preferencesStore = usePreferencesStore()

const terrain = computed(() => Terrain[props.hex?.terrain].toLowerCase())
</script>

<style lang="sass" scoped>
@import "~/styles/terrain-colors.sass"

.root
  .id
    font-size: 0.6em

  :deep(.hex)
    stroke: white
    stroke-width: 2px

  :deep(.hex.fancy)
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

@include terrain-colors(":deep(.hex)", fill)
</style>
