<template>
  <component
    :is="inSvg ? 'g' : 'svg'"
    :transform="fullTransform"
    :width="inSvg ? '' : 100"
    :height="inSvg ? '' : 100"
    :viewBox="!inSvg ? '0 0 100 100' : ''"
    class="root"
    :class="classes"
  >
    <rect width="100" height="100" x="0" y="0" class="background" />
    <image :href="imageUrl" width="98" height="98" x="1" y="1" :filter="filter" />
    <text x="50" y="18" class="name annotation" v-text="creature.name" />
    <text x="10" y="93" class="strength annotation" v-text="strength" />
    <text v-if="type === CreatureType.TITAN" x="50" y="83" class="annotation">&ndash;</text>
    <text x="90" y="93" class="skill annotation" v-text="creature.skill" />
    <g transform="translate(50 82) scale(1.1)" :class="{ 'both-present': creature.canFly && creature.canRangestrike }">
      <!-- icons copied directly from Adobe Illustrator -->
      <path v-if="creature.canRangestrike" class="icon rangestrike" d="M15,.966A50.386,50.386,0,0,1,6.37,7.9c-.513-1.114,1.262-3.18-1.041-2.533C3.69,5.823-1.16,7.7.394,6.878c-1.229.651.765-1.4,1.281-1.8C3.534,3.625,5.419,2.2,7.39.907c3.288-2.156,1.485.14,1.3.663C8.029,3.462,9.78,3.022,10.9,2.554,12.253,1.99,13.632,1.492,15,.966Z" />
      <path v-if="creature.canFly" class="icon flight" d="M4.893,0c.213.135.579.238.615.41C5.961,2.6,7.332,3.376,9.462,3.089c.163-.022.363.233.538.354-.2,1.354-1.769,1.507-2.223,2.6-.488,1.18.949,2.191.311,3.4C4.805,9,7.021,6.624,2.054,9.671c-.7-1.337.533-2.388.218-3.51C1.946,5,.328,4.837.013,3.43c-.059-.186.079-.3.445-.333C3.374,2.853,3.373,2.848,4.893,0Z" />
    </g>
  </component>
</template>

<script lang="ts">
import { defineComponent, PropType } from "@vue/runtime-core"
import { mapState } from "vuex"
import { Creature, CREATURE_DATA, CreatureType } from "~/models/creature"
import { Player } from "~/models/player"
import { CreatureColorMode } from "~/store/ui/preferences"
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

export default defineComponent({
  name: "Creature",
  props: {
    type: {
      type: Number as PropType<CreatureType>,
      required: true
    },
    player: {
      type: Player,
      required: false,
      default: undefined
    },
    inSvg: {
      type: Boolean,
      default: false
    },
    transform: {
      type: String,
      required: false,
      default: ""
    },
    wounds: {
      type: Number,
      required: false,
      default: 0
    }
  },
  data: () => ({
    CreatureType
  }),
  computed: {
    ...mapState("ui/preferences", ["creatureColorMode"]),
    creature(): Creature {
      return CREATURE_DATA[this.type]
    },
    imageUrl() {
      return new URL(`../../assets/creatures/${CreatureType[this.creature.type]}.svg`,
        import.meta.url).href
    },
    fullTransform() {
      return this.inSvg ? this.transform + " translate(-50 -50)" : ""
    },
    strength() {
      if (this.type === CreatureType.TITAN) {
        return Math.floor((this.player?.score ?? 0) / 100) + this.creature.strength
      } else {
        return this.creature.strength
      }
    },
    classes() {
      const classMap = {
        [this.creature.name.toLowerCase()]: true,
        "uniform-text": [CreatureColorMode.PLAYER_UNIFORM_TEXT,
          CreatureColorMode.STANDARD_UNIFORM_TEXT].includes(this.creatureColorMode)
      }
      if ([CreatureColorMode.STANDARD, CreatureColorMode.STANDARD_UNIFORM_TEXT]
        .includes(this.creatureColorMode) && !this.creature.lord) {
        classMap.standard = true
      } else {
        classMap[`text-player-${this.player?.color ?? 0}`] = true
      }
      return classMap
    },
    currentTheme() {
      return this.$vuetify.theme.getTheme(this.$vuetify.theme.current)
    },
    filter() {
      let color = this.currentTheme.colors[STANDARD_CREATURE_COLORS[this.type]]
      if (this.player !== undefined) {
        if (this.creature.lord || [CreatureColorMode.PLAYER_UNIFORM_TEXT,
          CreatureColorMode.PLAYER].includes(this.creatureColorMode)) {
          color = this.currentTheme.colors[`player-${this.player.color}`]
        }
      }
      return FilterCache.getForHex(color).filter
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

.annotation
  font-family: "Frank Ruhl Libre", serif
  font-weight: 900
  font-size: 12pt
  letter-spacing: -0.025em
  text-anchor: middle

.annotation, .icon
  fill: currentColor

.icon.rangestrike
  transform: translate(-7.5%, 2%)

.icon.flight
  transform: translate(-5%, 0)

.both-present
  .icon.rangestrike
    transform: translate(-17%, 2%)

  .icon.flight
    transform: translate(5%, 0)

.uniform-text
  .annotation, .icon
    fill: black

// These creatures need white icons on top of their colored image
.angel, .archangel, .warlock
  .icon
    fill: rgb(var(--v-theme-titan-white))

.archangel .name
  letter-spacing: -0.025em

.titan .annotation
  fill: rgb(var(--v-theme-titan-white))
  font-size: 16pt

  &.name
    display: none

  &.strength
    transform: translate(20%, -8%)

  &.skill
    transform: translate(-20%, -8%)

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

</style>
