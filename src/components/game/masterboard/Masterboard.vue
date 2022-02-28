<template>
  <div class="root">
    <svg
      class="board"
      viewBox="-400 -350 800 700"
      xmlns="http://www.w3.org/2000/svg"
      @click="deselectStack"
    >
      <MasterboardHexes :can-free-move="canFreeMove" />
      <v-fade-transition>
        <g v-if="paths.length > 0" :key="selectedStack.hex" class="paths">
          <g v-for="(step, distance) in interleavedPaths" :key="distance">
            <MasterboardHex
              v-for="([foe, hex], index) in step"
              :key="hex.id"
              :path-index="index"
              :distance-to-dest="activeRoll - distance"
              :hex="hex"
              :contains-enemy="foe"
              @click.stop="moveStack(distance, foe, hex)"
            />
          </g>
        </g>
      </v-fade-transition>
      <g v-if="stacks.length > 0" class="stacks">
        <MasterboardStack v-for="stack in sortedStacks" :key="stack.guid" :stack="stack" />
      </g>
    </svg>
    <StackPanel />
    <TurnPanel />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import _ from "lodash"
import { mapActions, mapGetters, mapMutations, mapState } from "vuex"
import { MasterboardPhase, Path } from "~/models/game"
import { MasterboardHex } from "~/models/masterboard"
import { Stack } from "~/models/stack"
import StackPanel from "../../ui/game/StackPanel.vue"
import TurnPanel from "../../ui/game/TurnPanel.vue"
import MasterboardHexComponent from "./MasterboardHex.vue"
import MasterboardHexes from "./MasterboardHexes.vue"
import MasterboardStack from "./MasterboardStack.vue"

let lastSortedStacks: Stack[] = []

export default defineComponent({
  name: "Masterboard",
  components: { MasterboardHexes, StackPanel, TurnPanel, MasterboardStack, MasterboardHex: MasterboardHexComponent },
  computed: {
    ...mapState("ui/preferences", ["freeMovement"]),
    ...mapState("game", ["activePhase", "stacks", "activeRoll"]),
    ...mapGetters("ui/selections", ["paths", "focusedStack", "selectedStack"]),
    sortedStacks(): Stack[] {
      lastSortedStacks = _.sortBy(this.stacks, stack =>
        stack === this.selectedStack ? 999 : lastSortedStacks.indexOf(stack))
      return lastSortedStacks
    },
    interleavedPaths(): [boolean, MasterboardHex][] {
      return _.range(this.paths[0].path.length).map((colIndex: number) =>
        this.paths.map((row: Path) => [row.foe !== undefined, row.path[colIndex]])).slice(1)
    },
    canFreeMove(): boolean {
      return this.activePhase === MasterboardPhase.MOVE &&
        this.focusedStack !== undefined && this.freeMovement
    }
  },
  methods: {
    ...mapMutations("ui/selections", ["deselectStack"]),
    ...mapActions("game", ["move"]),
    moveStack(distance: number, foe: boolean, hex: MasterboardHex) {
      if (distance !== this.activeRoll - 1 || this.focusedStack?.hasMoved() || foe) {
        return
      }
      this.move({ stack: this.focusedStack, hex })
      this.deselectStack()
    }
  }
})
</script>

<style lang="sass" scoped>
.root, .board, .interactive
  width: 100%
  user-select: none

.board, .interactive
  max-width: 1600px
  display: flex
  height: 100%

.battleboard-root
  height: calc(100vh - 30px)
  background-color: #101010

.interactive
  position: relative
  top: calc((100vh - 30px) * -1)
</style>
