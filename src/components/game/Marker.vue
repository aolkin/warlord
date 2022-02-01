<template>
  <component
    :is="inSvg ? 'g' : 'svg'"
    :transform="fullTransform"
    :width="inSvg ? '' : 100"
    :height="inSvg ? '' : 100"
    :viewBox="!inSvg ? '0 0 100 100' : ''"
    class="root"
  >
    <rect width="100" height="100" x="0" y="0" class="background" />
    <image :href="imageUrl" width="98" height="98" x="1" y="1" />
  </component>
</template>

<script lang="ts">
import { defineComponent, PropType } from "@vue/runtime-core"
import _ from "lodash"
import { PlayerId } from "~/models/player"

export default defineComponent({
  name: "Marker",
  props: {
    color: {
      type: Number as PropType<PlayerId>,
      required: true
    },
    marker: {
      type: Number,
      required: true
    },
    inSvg: {
      type: Boolean,
      default: false
    },
    transform: {
      type: String,
      required: false,
      default: ""
    }
  },
  computed: {
    imageUrl() {
      const id = _.padStart(String(this.color * 12 + this.marker + 1), 2, "0")
      return new URL(`../../assets/markers/marker-${id}.svg`, import.meta.url).href
    },
    fullTransform() {
      return this.inSvg ? this.transform + " translate(-50 -50)" : ""
    }
  }
})
</script>

<style scoped lang="sass">
.background
  fill: rgb(var(--v-theme-titan-white))
  stroke-width: 0.5px
  stroke: #353535

.root
  user-select: none
</style>
