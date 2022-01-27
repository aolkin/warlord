<template>
  <g>
    <rect width="46" height="46" x="-25" y="-12" class="background" />
    <image :href="imageUrl" width="44" height="44" x="-24" y="-11" />
  </g>
</template>

<script lang="ts">
import { defineComponent, PropType } from "@vue/runtime-core"
import _ from "lodash"
import { PlayerColor } from "~/models/player"

export default defineComponent({
  name: "Marker",
  props: {
    color: {
      type: Number as PropType<PlayerColor>,
      required: true
    },
    marker: {
      type: Number,
      required: true
    }
  },
  computed: {
    imageUrl() {
      const id = _.padStart(String(this.color * 12 + this.marker + 1), 2, "0")
      return new URL(`../../assets/markers/marker-${id}.svg`, import.meta.url).href
    }
  }
})
</script>

<style scoped lang="sass">
.background
  fill: rgb(252, 252, 252)
  stroke-width: 0.5px
  stroke: #353535
</style>
