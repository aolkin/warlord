<template>
  <g>
    <rect width="46" height="46" x="-25" y="-12" class="background" />
    <image :href="imageUrl" width="44" height="44" x="-24" y="-11" />
  </g>
</template>

<script lang="ts">
import { defineComponent, PropType } from "@vue/runtime-core"
import { Creature, CREATURE_DATA, CreatureType } from "~/models/creature"

export default defineComponent({
  name: "Creature",
  props: {
    type: {
      type: Number as PropType<CreatureType>,
      required: true
    }
  },
  computed: {
    creature(): Creature {
      return CREATURE_DATA[this.type]
    },
    imageUrl() {
      return new URL(`../../assets/creature/creature-${CreatureType[this.creature.type]}.svg`,
        import.meta.url).href
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
