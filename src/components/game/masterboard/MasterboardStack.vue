<template>
  <g
    :transform="transform"
    class="marker"
    :class="classes"
    @click.stop="select"
    @mouseenter="enter"
    @mouseleave="leave"
  >
    <Marker
      :color="stack.owner"
      :marker="stack.marker"
      in-svg
    />
    <text x="44" y="45" class="annotation stack-size" v-text="stackSize" />
    <text v-if="!selected && stacksOnHex.length > 1" x="0" y="0" class="annotation stack-count">
      x{{ stacksOnHex.length }}
    </text>
  </g>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapActions, mapGetters, mapMutations, mapState } from "vuex"
import { MasterboardPhase } from "~/models/game"
import { Stack } from "~/models/stack"
import Marker from "../Marker.vue"
import { hexTransform, isHexInverted, Transformation, TransformationType } from "./utils"

export default defineComponent({
  name: "MasterboardStack",
  components: { Marker },
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
    ...mapState("game", ["activePhase", "firstRound"]),
    ...mapGetters("game", ["activePlayerId", "mandatoryMoves", "stacksForHex"]),
    transform() {
      const transform = hexTransform(this.stack.hex)
      transform.push(new Transformation(TransformationType.TRANSLATE,
        [0, isHexInverted(this.stack.hex) ? -12 : 13]))
      if (this.stacksOnHex.length > 1) {
        transform.push(new Transformation(TransformationType.ROTATE, [15 + 35 * this.stacksOnHexIndex]))
      }
      if (this.selected) {
        transform.push(new Transformation(TransformationType.TRANSLATE, [2, -4]))
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
      }
      return false
    },
    classes() {
      return {
        selected: this.selected,
        owned: this.isActivePlayer,
        mandatory: this.isMandatory,
        disabled: this.isDisabled,
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
    ...mapMutations("ui/selections", ["selectStack", "deselectStack", "enterStack", "leaveStack"]),
    ...mapActions("game", ["move"]),
    select() {
      if (!(this.isActivePlayer)) {
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
    },
    leave() {
      this.leaveStack(this.stack)
    }
  }
})
</script>

<style lang="sass" scoped>
.marker
  transition: 0.2s ease-out

.owned:not(.disabled), .phase-move .owned
  cursor: grab

.mandatory
  filter: drop-shadow(0 0 4px #ec2c32)

.selected
  filter: drop-shadow(-4px 4px 6px #222222)

.disabled
  filter: brightness(50%)

.annotation
  font-family: "Eczar", serif
  font-weight: 800
  font-size: 16pt
  fill: rgb(var(--v-theme-primary))
  text-shadow: 2px 2px black

.stack-size
  text-anchor: end

.stack-count
  fill: rgb(var(--v-theme-secondary))
  font-size: 30pt
  text-anchor: middle
  dominant-baseline: central

</style>
