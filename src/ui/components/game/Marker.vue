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

const props = withDefaults(defineProps<{
  color: PlayerId
  marker: number
  inSvg?: boolean
  transform?: string
}>(), {
  inSvg: false,
  transform: ""
})

const markerUrls = import.meta.glob<string>("../../assets/markers/*.svg", {
  eager: true,
  import: "default",
  query: "?url"
})

const imageUrl = computed(() => {
  const id = padStart(String(props.color * 12 + props.marker + 1), 2, "0")
  const path = `../../assets/markers/marker-${id}.svg`
  const url = markerUrls[path]
  if (url === undefined) {
    console.warn(`Marker.vue: no crest asset for computed marker id "${id}" ` +
      `(color=${props.color}, marker=${props.marker}); rendering without a crest image.`)
  }
  return url
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
