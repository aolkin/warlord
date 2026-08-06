<template>
  <g
    :class="classes"
    :transform="hexTransformStr"
  >
    <rect
      v-for="x in shadowMaskXs"
      :key="x"
      :transform="transform"
      :x="x"
      class="shadow-mask"
      height="8"
      width="8"
      y="-10"
    />
    <g
      v-if="edge.rule === MovementRule.SQUARE"
      :transform="transform"
    >
      <polyline points="-4,-4 -4,4 4,4 4,-4" />
    </g>
    <g
      v-else-if="edge.rule === MovementRule.CIRCLE"
      :transform="transform"
    >
      <path
        d="M4,-4 v4 a4,4 0 1,1 -8,0 v-4"
        fill-rule="nonzero"
      />
    </g>
    <g
      v-else-if="edge.rule === MovementRule.ARROW && multiArrow"
      :transform="transform"
    >
      <polyline points="-24,-3.25 -20,3 -16,-3.25" />
      <polyline points="-14,-3.25 -10,3  -6,-3.25" />
      <polyline points=" -4,-3.25   0,3   4,-3.25" />
      <polyline
        v-if="preferencesStore.fancyGraphics"
        class="no-shadow"
        points="-16.5,-3.25, -13.5,-3.25"
      />
      <polyline
        v-if="preferencesStore.fancyGraphics"
        class="no-shadow"
        points="-26.5,-3.25, -23.5,-3.25"
      />
    </g>
    <g
      v-else
      :transform="transform"
    >
      <polyline points="-4,-4 0,3 4,-4" />
    </g>
    <g
      v-if="preferencesStore.fancyGraphics"
      :transform="transform"
    >
      <polyline
        class="no-shadow"
        points="-6.5,-3.25, -3.5,-3.25"
      />
      <polyline
        class="no-shadow"
        points="3.5,-3.25, 6.5,-3.25"
      />
    </g>
  </g>
</template>
<script setup lang="ts">
import { computed } from "vue"
import { MasterboardEdge, MasterboardHex, MovementRule, Terrain } from "~/models/masterboard"
import { usePreferencesStore } from "~/stores/ui/preferences"
import { hexTransform, isHexInverted, TRIANGLE_HEIGHT } from "./utils"

const props = withDefaults(defineProps<{
  edge: MasterboardEdge
  hex: MasterboardHex
  shadow?: boolean
}>(), {
  shadow: false
})

const preferencesStore = usePreferencesStore()

const multiArrow = computed((): boolean => props.edge.rule === MovementRule.ARROW &&
  !props.edge.hex.getEdges().some(edge =>
    edge.rule !== MovementRule.NONE && edge.hex.id === props.hex.id))

const hexTransformStr = computed((): string => hexTransform(props.hex.id).toString())

const transform = computed(() => `rotate(${isHexInverted(props.hex.id) ? 180 : 0})
              translate(0 10)
              rotate(${(props.edge.hexEdge - 1) * 120})
              translate(${props.edge.hexEdge === 1 ? 10 : (props.edge.hexEdge === 0 ? 6 : 14)} 0)
              translate(0 ${TRIANGLE_HEIGHT / 4 + (props.edge.hexEdge === 1 ? 13.75 : 7.25)})`)

const classes = computed(() => ({
  [Terrain[props.hex.terrain].toLowerCase()]: true,
  ["to-" + Terrain[props.edge.hex.terrain].toLowerCase()]: true,
  root: !props.shadow,
  shadow: props.shadow
}))

const shadowMaskXs = computed(() => props.shadow ? (multiArrow.value ? [-4, -14, -24] : [-4]) : [])
</script>

<style lang="sass" scoped>
@import "@/styles/terrain-colors.sass"

.root > g, .shadow > g
  fill: transparent
  stroke: white
  stroke-width: 1.5px

.shadow path, .shadow polyline:not(.no-shadow)
  filter: drop-shadow(0px 0px 1px #000000aa)

polyline.no-shadow
  stroke-width: 1.25px

.shadow-mask
  stroke-width: 0px
  filter: blur(1px)

@include terrain-colors("&.root polyline, &.root path, &.shadow rect.shadow-mask", fill)
</style>
