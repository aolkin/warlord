<template>
  <div class="root">
    <svg
      class="board"
      viewBox="-400 -350 800 700"
      xmlns="http://www.w3.org/2000/svg"
      @click="deselectStack"
    >
      <g class="masterboard">
        <g class="hexes">
          <MasterboardHex
            v-for="id in hexes"
            :key="id"
            :hex="board.getHex(id)"
            @click="canFreeMove && move({ stack: focusedStack, hex: id })"
          />
        </g>
        <MasterboardEdges />
      </g>
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
import board, { Masterboard, MasterboardHex } from "~/models/masterboard"
import { Stack } from "~/models/stack"
import StackPanel from "../../ui/game/StackPanel.vue"
import TurnPanel from "../../ui/game/TurnPanel.vue"
import MasterboardEdges from "./MasterboardEdges.vue"
import MasterboardHexComponent from "./MasterboardHex.vue"
import MasterboardStack from "./MasterboardStack.vue"

let lastSortedStacks: Stack[] = []

export default defineComponent({
  name: "Masterboard",
  components: { MasterboardEdges, StackPanel, TurnPanel, MasterboardStack, MasterboardHex: MasterboardHexComponent },
  computed: {
    ...mapState("ui/preferences", ["freeMovement"]),
    ...mapState("game", ["activePhase", "stacks", "activeRoll"]),
    ...mapGetters("ui/selections", ["paths", "focusedStack", "selectedStack"]),
    board(): Masterboard {
      return board
    },
    hexes(): number[] {
      return this.board.getHexIds()
    },
    sortedStacks(): Stack[] {
      lastSortedStacks = _.sortBy(this.stacks, stack =>
        stack === this.selectedStack ? 999 : lastSortedStacks.indexOf(stack))
      return lastSortedStacks
    },
    interleavedPaths(): [boolean, MasterboardHex[]][] {
      const pathsByLength = _.sortBy(this.paths, paths => -paths[1].length)
      return pathsByLength[0][1].map((i: any, colIndex: number) =>
        this.paths.map((row: Path) => [row[0], row[1][colIndex]]))
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

.root
  height: calc(100vh - 30px)
  background-color: #101010

.interactive
  position: relative
  top: calc((100vh - 30px) * -1)
</style>
