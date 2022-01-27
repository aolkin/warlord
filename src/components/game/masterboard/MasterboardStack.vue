<template>
  <Marker
    :color="stack.player.color"
    :marker="stack.marker"
    :transform="transform"
    class="marker"
    :class="classes"
    @click.stop="select"
    @mouseenter="enter"
    @mouseleave="leave"
  />
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapGetters, mapMutations, mapState } from "vuex"
import { MasterboardPhase } from "~/models/game"
import { Stack } from "~/models/stack"
import Marker from "../Marker.vue"
import { hexTransform } from "./utils"

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
    ...mapState("game", ["activePhase"]),
    ...mapGetters("game", ["activePlayer"]),
    transform() {
      return hexTransform(this.stack.hex) + (this.selected ? "translate(4 -10)" : "")
    },
    selected() {
      return this.stack === this.selectedStack
    },
    isActivePlayer() {
      return this.activePlayer === this.stack.player
    },
    classes() {
      return {
        selected: this.selected,
        highlight: this.isActivePlayer && this.activePhase === MasterboardPhase.MOVE
      }
    }
  },
  methods: {
    ...mapMutations("ui/selections", ["selectStack", "deselectStack", "enterStack", "leaveStack"]),
    select() {
      if (!(this.isActivePlayer && this.activePhase === MasterboardPhase.MOVE)) {
        return
      }
      if (this.selected) {
        this.deselectStack()
      } else {
        this.selectStack(this.stack)
      }
    },
    enter() {
      this.enterStack(this)
    },
    leave() {
      this.leaveStack(this)
    }
  }
})
</script>

<style lang="sass" scoped>
.marker
  transition: 0.25s ease-out

.highlight
  cursor: pointer
  filter: drop-shadow(0 0 2px #fedcba)

.selected
  filter: drop-shadow(4px 4px 4px black)
</style>
