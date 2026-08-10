<template>
  <component
    :is="inSvg ? 'g' : 'svg'"
    :transform="fullTransform"
    :width="inSvg ? '' : 100"
    :height="inSvg ? '' : 100"
    :viewBox="inSvg ? '' : '0 0 100 100'"
    class="creature-root"
    :class="classes"
  >
    <rect
      width="100"
      height="100"
      x="0"
      y="0"
      class="background"
    />
    <template v-if="!isCreatureType(type)">
      <text
        x="50"
        :y="18 + (labelWords.length - 1) * -16"
        class="name annotation"
      >
        <tspan
          v-for="(word, index) in labelWords"
          :key="index"
          x="50"
          dy="32"
        >
          {{ word }}
        </tspan>
      </text>
    </template>
    <template v-else>
      <image
        :href="imageUrl"
        width="98"
        height="98"
        x="1"
        y="1"
        :filter="filter"
      />
      <text
        x="50"
        y="15"
        class="name annotation"
      >
        {{ creatureName }}
      </text>
      <text
        x="10"
        y="90"
        class="strength annotation"
        :class="titanStrength"
      >
        {{ strength }}
      </text>
      <text
        v-if="type === CreatureType.TITAN"
        x="50"
        y="83"
        class="annotation"
      >
        &ndash;
      </text>
      <text
        x="90"
        y="90"
        class="skill annotation"
      >
        {{ creature?.skill }}
      </text>
      <g v-if="dead">
        <!-- mdi-skull -->
        <path
          class="wounds annotation"
          transform="translate(25, 28) scale(2)"
          d="M12,2A9,9 0 0,0 3,11C3,14.03 4.53,16.82 7,18.47V22H9V19H11V22H13V19H15V22H17V18.46C19.47,16.81 21,14 21,11A9,9 0 0,0 12,2M8,11A2,2 0 0,1 10,13A2,2 0 0,1 8,15A2,2 0 0,1 6,13A2,2 0 0,1 8,11M16,11A2,2 0 0,1 18,13A2,2 0 0,1 16,15A2,2 0 0,1 14,13A2,2 0 0,1 16,11M12,14L13.5,17H10.5L12,14Z"
        />
      </g>
      <g v-else-if="wounds">
        <text
          x="50"
          y="45"
          class="wounds number annotation"
        >
          {{ wounds }}
        </text>
        <text
          x="50"
          y="75"
          class="wounds label annotation"
        >
          {{ `Hit${wounds > 1 ? 's' : ''}` }}
        </text>
      </g>
      <g
        transform="translate(50 82) scale(1.1)"
        :class="{ 'both-present': creature?.canFly && creature?.canRangestrike }"
      >
        <!-- icons copied directly from Adobe Illustrator -->
        <path
          v-if="creature?.canRangestrike"
          class="icon rangestrike"
          d="M15,.966A50.386,50.386,0,0,1,6.37,7.9c-.513-1.114,1.262-3.18-1.041-2.533C3.69,5.823-1.16,7.7.394,6.878c-1.229.651.765-1.4,1.281-1.8C3.534,3.625,5.419,2.2,7.39.907c3.288-2.156,1.485.14,1.3.663C8.029,3.462,9.78,3.022,10.9,2.554,12.253,1.99,13.632,1.492,15,.966Z"
        />
        <path
          v-if="creature?.canFly"
          class="icon flight"
          d="M4.893,0c.213.135.579.238.615.41C5.961,2.6,7.332,3.376,9.462,3.089c.163-.022.363.233.538.354-.2,1.354-1.769,1.507-2.223,2.6-.488,1.18.949,2.191.311,3.4C4.805,9,7.021,6.624,2.054,9.671c-.7-1.337.533-2.388.218-3.51C1.946,5,.328,4.837.013,3.43c-.059-.186.079-.3.445-.333C3.374,2.853,3.373,2.848,4.893,0Z"
        />
      </g>
    </template>
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useTheme } from "vuetify"
import { Creature, CREATURE_DATA, CreatureType } from "@/models/creature"
import { PlayerId } from "@/models/player"
import { useGameStore } from "~/stores/game"
import { CreatureColorMode, usePreferencesStore } from "~/stores/ui/preferences"
import FilterCache from "./color-util"
import { TitanColor } from "./types"

const STANDARD_CREATURE_COLORS: Record<CreatureType, TitanColor> = {
  [CreatureType.ANGEL]: TitanColor.BLACK,
  [CreatureType.ARCHANGEL]: TitanColor.ORANGE,
  [CreatureType.BEHEMOTH]: TitanColor.GREEN,
  [CreatureType.CENTAUR]: TitanColor.YELLOW,
  [CreatureType.COLOSSUS]: TitanColor.PURPLE,
  [CreatureType.CYCLOPS]: TitanColor.GREEN,
  [CreatureType.DRAGON]: TitanColor.RED,
  [CreatureType.GARGOYLE]: TitanColor.BLACK,
  [CreatureType.GIANT]: TitanColor.BLUE,
  [CreatureType.GORGON]: TitanColor.BLACK,
  [CreatureType.GRIFFON]: TitanColor.ORANGE,
  [CreatureType.GUARDIAN]: TitanColor.PURPLE,
  [CreatureType.HYDRA]: TitanColor.ORANGE,
  [CreatureType.LION]: TitanColor.RED,
  [CreatureType.MINOTAUR]: TitanColor.BROWN,
  [CreatureType.OGRE]: TitanColor.BROWN,
  [CreatureType.RANGER]: TitanColor.PURPLE,
  [CreatureType.SERPENT]: TitanColor.ORANGE,
  [CreatureType.TITAN]: TitanColor.BLACK,
  [CreatureType.TROLL]: TitanColor.BLUE,
  [CreatureType.UNICORN]: TitanColor.ORANGE,
  [CreatureType.WARBEAR]: TitanColor.YELLOW,
  [CreatureType.WARLOCK]: TitanColor.ORANGE,
  [CreatureType.WYVERN]: TitanColor.PURPLE
}

const props = withDefaults(defineProps<{
  type: CreatureType | string
  playerId?: PlayerId
  inSvg?: boolean
  transform?: string
  wounds?: number
}>(), {
  playerId: undefined,
  inSvg: false,
  transform: "",
  wounds: 0
})

// `type` is either a real CreatureType (a number) or an arbitrary label string.
function isCreatureType(type: CreatureType | string): type is CreatureType {
  return typeof type === "number"
}

const gameStore = useGameStore()
const preferencesStore = usePreferencesStore()
const theme = useTheme()

const playerScore = computed(() => props.playerId !== undefined ? gameStore.game.score[props.playerId] : undefined)

const creature = computed((): Creature | undefined =>
  isCreatureType(props.type) ? CREATURE_DATA[props.type] : undefined)

const creatureName = computed((): string => creature.value?.name.toUpperCase() ?? "")

const imageUrl = computed(() => isCreatureType(props.type)
  ? new URL(`../../assets/creatures/${CreatureType[props.type]}.svg`, import.meta.url).href
  : "")

const fullTransform = computed(() => props.inSvg ? props.transform + " translate(-50 -50)" : "")

const strength = computed(() => creature.value?.getStrength(playerScore.value ?? 0))

const dead = computed((): boolean => props.wounds >= (strength.value ?? 1))

const classes = computed(() => {
  // With no playerId to color-code by, fall back to the fixed per-creature-type styling.
  if (props.playerId === undefined) {
    return { label: true, standard: true }
  }
  const classMap: Record<string, boolean> = {
    [creature.value?.name.toLowerCase() ?? "label"]: true,
    "uniform-text": [CreatureColorMode.PLAYER_UNIFORM_TEXT,
      CreatureColorMode.STANDARD_UNIFORM_TEXT].includes(preferencesStore.creatureColorMode)
  }
  if ([CreatureColorMode.STANDARD, CreatureColorMode.STANDARD_UNIFORM_TEXT]
    .includes(preferencesStore.creatureColorMode) && !creature.value?.lord) {
    classMap.standard = true
  } else {
    classMap[`text-player-${props.playerId ?? 0}`] = true
  }
  return classMap
})

const titanStrength = computed(() => ({
  "double-digits": (creature.value?.type === CreatureType.TITAN &&
    (playerScore.value ?? 0) >= 400)
}))

const filter = computed(() => {
  let color = theme.current.value.colors[STANDARD_CREATURE_COLORS[isCreatureType(props.type) ? props.type : CreatureType.ANGEL]]
  if (props.playerId !== undefined) {
    if (creature.value?.lord || [CreatureColorMode.PLAYER_UNIFORM_TEXT,
      CreatureColorMode.PLAYER].includes(preferencesStore.creatureColorMode)) {
      color = theme.current.value.colors[`player-${props.playerId}`]
    }
  }
  return FilterCache.getForHex(color).filter
})

const labelWords = computed((): string[] =>
  isCreatureType(props.type) ? [] : props.type.split(/\s/))
</script>

<style scoped lang="sass">
.background
  fill: rgb(var(--v-theme-titan-white))
  stroke-width: 0.5px
  stroke: #353535

.creature-root
  user-select: none
  position: relative

.annotation
  font-family: "Frank Ruhl Libre", serif
  font-weight: 900
  font-size: 12pt
  letter-spacing: -0.025em
  text-anchor: middle
  dominant-baseline: middle

  &.wounds
    fill: #d61c1c
    font-family: Arvo, Roboto, sans-serif
    letter-spacing: normal
    stroke: black

    &.number
      font-size: 30pt
      stroke-width: 2px

    &.label
      font-size: 18pt
      stroke-width: 1px
      text-transform: uppercase

.annotation, .icon
  fill: currentColor

.icon.rangestrike
  transform: translate(-7.5px, 2px)

.icon.flight
  transform: translate(-5.5px, 0)

.both-present
  .icon.rangestrike
    transform: translate(-17px, 2px)

  .icon.flight
    transform: translate(5px, 0)

.uniform-text
  .annotation, .icon
    fill: black

// These creatures need white icons on top of their colored image
.angel, .archangel, .warlock
  .icon
    fill: rgb(var(--v-theme-titan-white))

.archangel .name
  letter-spacing: -0.025em

.titan .annotation:not(.wounds)
  fill: rgb(var(--v-theme-titan-white))
  font-size: 16pt

  &.name
    display: none

  &.strength
    transform: translate(20px, -8.5px)

    &.double-digits
      transform: translate(18px, -8.5px)

  &.skill
    transform: translate(-20px, -8.5px)

.standard
  &.ogre, &.minotaur
    color: rgb(var(--v-theme-titan-brown))
  &.warbear, &.centaur
    color: rgb(var(--v-theme-titan-yellow))
  &.gargoyle, &.gorgon
    color: rgb(var(--v-theme-titan-black))
  &.cyclops, &.behemoth
    color: rgb(var(--v-theme-titan-green))
  &.lion, &.dragon
    color: rgb(var(--v-theme-titan-red))
  &.troll, &.giant
    color: rgb(var(--v-theme-titan-blue))
  &.unicorn, &.griffon, &.hydra, &.serpent, &.warlock
    color: rgb(var(--v-theme-titan-orange))
  &.ranger, &.wyvern, &.colossus, &.guardian
    color: rgb(var(--v-theme-titan-purple))

.standard.label
  color: rgb(var(--v-theme-titan-red))

  .name
    font-size: 32px
    dominant-baseline: central
</style>
