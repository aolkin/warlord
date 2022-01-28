<template>
  <div class="root">
    <svg
      class="board"
      viewBox="-400 -350 800 700"
      xmlns="http://www.w3.org/2000/svg"
      @click="deselectStack"
    >
      <g class="board">
        <g class="hexes">
          <MasterboardHex
            v-for="id in hexes"
            :key="id"
            :hex="board.getHex(id)"
          />
        </g>
        <MasterboardEdges />
      </g>
    </svg>
    <svg
      class="interactive"
      viewBox="-400 -350 800 700"
      xmlns="http://www.w3.org/2000/svg"
      @click="deselectStack"
    >
      <v-fade-transition>
        <g v-if="paths.length > 0" :key="selectedStack.hex" class="paths">
          <g v-for="(step, distance) in interleavedPaths" :key="distance">
            <MasterboardHex
              v-for="([foe, hex], index) in step"
              :key="index"
              :path-index="index"
              :distance-to-dest="paths[0].length - distance"
              :hex="hex"
              @click="distance === paths[0].length - 1 && move({ stack: focusedStack, hex })"
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
import { mapGetters, mapMutations } from "vuex"
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
    ...mapGetters("game", ["stacks"]),
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
    interleavedPaths(): [boolean, MasterboardHex][][] {
      return this.paths[0].map((i: any, colIndex: number) =>
        this.paths.map((row: MasterboardHex[]) => row[colIndex]))
    }
  },
  methods: {
    ...mapMutations("ui/selections", ["deselectStack"]),
    ...mapMutations("game", ["move"])
  }
})
</script>

<style lang="sass" scoped>
.root, .board, .interactive
  width: 100%
  user-select: none

.board, .interactive
  max-width: 1600px
  margin: auto
  display: flex
  height: 100%

.root
  height: calc(100vh - 30px)
  background-color: #101010

.interactive
  position: relative
  top: calc((100vh - 30px) * -1)
</style>
