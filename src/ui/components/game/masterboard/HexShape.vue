<template>
  <g
    :transform="transform"
    class="root"
    @mouseenter="selectionStore.enterHex(hex)"
    @mouseleave="selectionStore.leaveHex(hex)"
  >
    <polygon
      :class="{ fancy: preferencesStore.fancyGraphics }"
      :points="HEX_POINTS"
      :transform="inverted ? 'rotate(180)' : ''"
      class="hex"
    />
    <slot
      :inverted="inverted"
      :hex-points="HEX_POINTS"
    />
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { MasterboardHex } from "@/models/masterboard"
import { usePreferencesStore } from "~/stores/ui/preferences"
import { useSelectionStore } from "~/stores/ui/selection"
import { HEX_POINTS, hexTransform, isHexInverted } from "./utils"

const props = defineProps<{
  hex: MasterboardHex
}>()

const preferencesStore = usePreferencesStore()
const selectionStore = useSelectionStore()

const transform = computed((): string => hexTransform(props.hex.id).toString())

const inverted = computed(() => isHexInverted(props.hex.id))
</script>

<style lang="sass" scoped>
.root
  font-family: Quintessential, "Fanwood Text", serif
  font-weight: bold
  font-size: 0.75em
  text-transform: uppercase
</style>
