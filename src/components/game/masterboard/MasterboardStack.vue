<template>
  <g
    :transform="transform"
    class="marker"
    :class="classes"
    @click.stop="select"
    @mouseenter="enter"
    @mouseleave="leave"
  >
    <rect
      v-for="i in stack.creatures.length"
      :key="i"
      width="100"
      height="100"
      x="-50"
      :y="-50"
      :transform="selected ? '' : `translate(0 ${4 * (stack.creatures.length - i)})`"
      :filter="`brightness(${100 - 5 * (stack.creatures.length - i)}%)`"
      class="creature"
    />
    <Marker
      :color="stack.owner"
      :marker="stack.marker"
      in-svg
    />
    <text x="44" y="45" class="annotation stack-size" v-text="stackSize" />
    <text v-if="!selected && stacksOnHex.length > 1 && !engaged" x="0" y="0" class="annotation stack-count">
      x{{ stacksOnHex.length }}
    </text>
    <!-- sword-cross from Material Design Icons -->
    <path
      v-if="engageable || engaged"
      class="engage-graphic"
      d="M6.2,2.44L18.1,14.34L20.22,12.22L21.63,13.63L19.16,16.1L22.34,19.28C22.73,19.67 22.73,20.3 22.34,20.69L21.63,21.4C21.24,21.79 20.61,21.79 20.22,21.4L17,18.23L14.56,20.7L13.15,19.29L15.27,17.17L3.37,5.27V2.44H6.2M15.89,10L20.63,5.26V2.44H17.8L13.06,7.18L15.89,10M10.94,15L8.11,12.13L5.9,14.34L3.78,12.22L2.37,13.63L4.84,16.1L1.66,19.29C1.27,19.68 1.27,20.31 1.66,20.7L2.37,21.41C2.76,21.8 3.39,21.8 3.78,21.41L7,18.23L9.44,20.7L10.85,19.29L8.73,17.17L10.94,15Z"
    />
    <transition name="muster">
      <g v-if="stack.currentMuster !== undefined" class="recruited-creature">
        <Creature
          :type="stack.currentMuster[0]"
          :player="stackPlayer"
          in-svg
        />
      </g>
    </transition>
  </g>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapActions, mapGetters, mapMutations, mapState } from "vuex"
import { CreatureType } from "~/models/creature"
import { MasterboardPhase, Path } from "~/models/game"
import masterboard, { MasterboardHex } from "~/models/masterboard"
import { Player } from "~/models/player"
import { Stack } from "~/models/stack"
import Creature from "../Creature.vue"
import Marker from "../Marker.vue"
import { hexTransform, isHexInverted, Transformation, TransformationType } from "./utils"

export default defineComponent({
  name: "MasterboardStack",
  components: { Creature, Marker },
  props: {
    stack: {
      type: Stack,
      required: true
    }
  },
  computed: {
    ...mapState("ui/selections", {
      selectedStack: "stack"
    }),
    ...mapGetters("ui/selections", ["paths"]),
    ...mapState("game", ["activePhase", "activeRoll"]),
    ...mapGetters("game", [
      "activePlayerId", "activePlayer", "mandatoryMoves", "stacksForHex", "firstRound", "playerById"
    ]),
    transform() {
      const transform = hexTransform(this.stack.hex)
      transform.push(new Transformation(TransformationType.TRANSLATE,
        [0, isHexInverted(this.stack.hex) ? -12 : 13]))
      if (this.stacksOnHex.length > 1) {
        transform.push(new Transformation(TransformationType.ROTATE, [15 + 35 * this.stacksOnHexIndex]))
      }
      if (this.selected) {
        transform.push(new Transformation(TransformationType.TRANSLATE, [2, -4]))
      } else {
        transform.push(new Transformation(TransformationType.TRANSLATE, [0, -1 * this.stack.creatures.length]))
      }
      transform.push(new Transformation(TransformationType.SCALE, [0.48]))
      return transform.toString()
    },
    selected() {
      return this.stack === this.selectedStack
    },
    isActivePlayer() {
      return this.activePlayerId === this.stack.owner
    },
    stackPlayer(): Player {
      return this.playerById(this.stack.owner)
    },
    engageable(): boolean {
      if (this.selectedStack === undefined) {
        return false
      } else if (this.stacksForHex(this.stack.hex)
        .some((stack: Stack) => stack.owner === this.activePlayerId)) {
        return false
      } else if (this.activeRoll === 6 && this.activePlayer.score >= 400 &&
        this.selectedStack.creatures.includes(CreatureType.TITAN)) {
        return true
      } else {
        return this.paths.flatMap((path: Path) => path[1])
          .map((hex: MasterboardHex) => hex.id).includes(this.stack.hex)
      }
    },
    engaged(): boolean {
      return this.isActivePlayer && this.stacksForHex(this.stack.hex)
        .some((stack: Stack) => stack.owner !== this.activePlayerId)
    },
    isMandatory() {
      if (!this.isActivePlayer) {
        return false
      }
      switch (this.activePhase) {
        case MasterboardPhase.SPLIT:
          return !this.stack.isValidSplit(this.firstRound)
        case MasterboardPhase.MOVE:
          return this.mandatoryMoves.includes(this.stack)
      }
      return false
    },
    isDisabled() {
      if (!this.isActivePlayer) {
        return false
      }
      switch (this.activePhase) {
        case MasterboardPhase.SPLIT:
          return this.stack.creatures.length < 4
        case MasterboardPhase.MOVE:
          return this.stack.hasMoved()
        case MasterboardPhase.MUSTER:
          return !this.stack.canMuster()
      }
      return false
    },
    classes() {
      return {
        selected: this.selected,
        owned: this.isActivePlayer,
        mandatory: this.isMandatory,
        disabled: this.isDisabled,
        engageable: this.engageable,
        engaged: this.engaged,
        [`player-${this.stack.owner}`]: true,
        "multiple-stacks": this.stacksOnHex.length > 1,
        [`stack-on-hex-${this.stacksOnHexIndex}`]: true,
        [`phase-${MasterboardPhase[this.activePhase].toLowerCase()}`]: true
      }
    },
    stackSize(): string {
      if (this.stack.split.some(i => i)) {
        return `${this.stack.creatures.length - this.stack.numSplitting()} / ${this.stack.numSplitting()}`
      }
      return `${this.stack.creatures.length}`
    },
    stacksOnHex(): Stack[] {
      return this.stacksForHex(this.stack.hex)
    },
    stacksOnHexIndex(): number {
      return this.stacksOnHex.indexOf(this.stack)
    }
  },
  methods: {
    ...mapMutations("ui/selections", [
      "selectStack", "deselectStack", "enterStack", "leaveStack",
      "enterHex", "leaveHex"
    ]),
    ...mapActions("game", ["move"]),
    select() {
      if (!(this.isActivePlayer)) {
        if (this.engageable) {
          this.move({ stack: this.selectedStack, hex: this.stack.hex })
          this.deselectStack()
        }
        return
      }
      if (this.activePhase === MasterboardPhase.MOVE && this.stack.hasMoved()) {
        if (!this.stacksForHex(this.stack.origin).some((stack: Stack) => stack.hasMoved())) {
          this.move({ stack: this.stack, hex: this.stack.origin })
        }
      }
      if (this.selected) {
        this.deselectStack()
      } else {
        if (!this.isDisabled) {
          this.selectStack(this.stack)
        }
      }
    },
    enter() {
      this.enterStack(this.stack)
      this.enterHex(masterboard.getHex(this.stack.hex))
    },
    leave() {
      this.leaveStack(this.stack)
      this.leaveHex(masterboard.getHex(this.stack.hex))
    }
  }
})
</script>

<style lang="sass" scoped>
.creature
  fill: rgb(var(--v-theme-titan-white))
  stroke-width: 0.5px
  stroke: #353535
  transition: 0.2s ease-out

.marker
  transition: 0.2s ease-out

.owned:not(.disabled), .phase-move .owned
  cursor: grab

.mandatory
  filter: drop-shadow(0 0 4px #ec2c32)

.selected
  filter: drop-shadow(-4px 4px 6px #222222)

.owned.selected
  cursor: grabbing

.disabled
  filter: brightness(50%)

.engageable
  cursor: pointer

.annotation
  font-family: "Eczar", serif
  font-weight: 800
  font-size: 30pt
  fill: rgb(var(--v-theme-primary))
  text-shadow: 2px 2px black

.stack-size
  text-anchor: end

.stack-count
  fill: rgb(var(--v-theme-secondary))
  font-size: 30pt
  text-anchor: middle
  dominant-baseline: central

.engage-graphic
  fill: #e5051e
  stroke: black
  stroke-width: 0.75px
  transform: scale(3) translate(-12px, -12px)
  transition: all 0.25s

.marker:hover:not(.engaged) .engage-graphic
  transform: scale(4) translate(-12px, -12px)

.recruited-creature
  transform: rotate(25deg) scale(0.85)
  opacity: 1
  transition: transform 0.25s ease-out, opacity 0.2s

  &:hover
    opacity: 0.25

.muster-enter-active, .muster-leave-active
  transform: rotate(25deg) scale(0.85)

.muster-enter-from, .muster-leave-to
  opacity: 0
  transform: rotate(0) scale(1)

</style>
