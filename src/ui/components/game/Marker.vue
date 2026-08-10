<template>
  <component
    :is="inSvg ? 'g' : 'svg'"
    :transform="fullTransform"
    :width="inSvg ? '' : 100"
    :height="inSvg ? '' : 100"
    :viewBox="!inSvg ? '0 0 100 100' : ''"
    class="root"
  >
    <rect
      width="100"
      height="100"
      x="0"
      y="0"
      class="background"
    />
    <image
      :href="imageUrl"
      width="98"
      height="98"
      x="1"
      y="1"
    />
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { padStart } from "lodash-es"
import { PlayerId } from "@/models/player"
import { assert } from "@/utils/assert"

const props = withDefaults(defineProps<{
  color: PlayerId
  marker: number
  inSvg?: boolean
  transform?: string
}>(), {
  inSvg: false,
  transform: ""
})

// Only 5 colors x 12 markers of crest art exist (60 files). An out-of-range
// color/marker silently resolves the asset URL below to this component's own
// directory instead of throwing, rendering a broken image with no console
// error, so validate the range explicitly and skip the URL construction.
const imageUrl = computed((): string | undefined => {
  const numericId = props.color * 12 + props.marker + 1
  const valid = numericId >= 1 && numericId <= 60
  assert(valid, `No marker crest art for color=${props.color}, marker=${props.marker}`)
  if (!valid) {
    return undefined
  }
  const id = padStart(String(numericId), 2, "0")
  return new URL(`../../assets/markers/marker-${id}.svg`, import.meta.url).href
})

const fullTransform = computed(() => props.inSvg ? props.transform + " translate(-50 -50)" : "")
</script>

<style scoped lang="sass">
.background
  fill: rgb(var(--v-theme-titan-white))
  stroke-width: 0.5px
  stroke: #353535

.root
  user-select: none
</style>
