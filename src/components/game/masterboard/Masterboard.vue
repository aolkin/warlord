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
        <g
          v-if="selectionStore.paths.length > 0"
          :key="selectionStore.selectedStack!.hex"
          class="paths"
        >
          <g
            v-for="(step, distance) in interleavedPaths"
            :key="distance"
          >
            <MasterboardHexComponent
              v-for="([foe, hex], index) in step"
              :key="hex.id"
              :path-index="index"
              :distance-to-dest="activeRoll! - distance"
              :hex="hex"
              :contains-enemy="foe"
              @click.stop="moveStack(distance, foe, hex)"
            />
          </g>
        </g>
      </v-fade-transition>
      <g
        v-if="stacks.length > 0"
        class="stacks"
      >
        <MasterboardStack
          v-for="stack in sortedStacks"
          :key="stack.id"
          :stack="stack"
        />
      </g>
    </svg>
    <StackPanel
      class="ma-3"
      position="fixed"
      location="top right"
    />
    <TurnPanel
      class="ma-3 mb-10"
      position="fixed"
      location="bottom right"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { range, sortBy } from "lodash-es"
import { MasterboardPhase, Path } from "~/models/game"
import { MasterboardHex } from "~/models/masterboard"
import { Stack } from "~/models/stack"
import { useTypedStore } from "~/plugins/vuex"
import { usePreferencesStore } from "~/stores/ui/preferences"
import { useSelectionStore } from "~/stores/ui/selection"
import StackPanel from "../../ui/game/StackPanel.vue"
import TurnPanel from "../../ui/game/TurnPanel.vue"
import MasterboardHexComponent from "./MasterboardHex.vue"
import MasterboardHexes from "./MasterboardHexes.vue"
import MasterboardStack from "./MasterboardStack.vue"

let lastSortedStacks: Stack[] = []

const preferencesStore = usePreferencesStore()
const selectionStore = useSelectionStore()
const store = useTypedStore()

const activePhase = computed(() => store.state.game.activePhase)
const stacks = computed(() => store.state.game.stacks)
// activeRoll is only read from template branches that are only rendered once the
// selection store's "paths" getter is non-empty, which itself requires activeRoll
// to be defined - see src/stores/ui/selection.ts.
const activeRoll = computed(() => store.state.game.activeRoll!)

const sortedStacks = computed((): Stack[] => {
  lastSortedStacks = sortBy(stacks.value, stack =>
    stack === selectionStore.selectedStack ? 999 : lastSortedStacks.indexOf(stack))
  return lastSortedStacks
})
const interleavedPaths = computed((): [boolean, MasterboardHex][][] =>
  range(selectionStore.paths[0].path.length).map((colIndex: number) =>
    selectionStore.paths.map((row: Path): [boolean, MasterboardHex] =>
      [row.foe !== undefined, row.path[colIndex]])).slice(1))

const canFreeMove = computed((): boolean =>
  activePhase.value === MasterboardPhase.MOVE &&
  selectionStore.focusedStack !== undefined && preferencesStore.freeMovement)

function deselectStack(): void {
  selectionStore.deselectStack()
}

function moveStack(distance: number, foe: boolean, hex: MasterboardHex): void {
  if (distance !== activeRoll.value - 1 || selectionStore.focusedStack?.hasMoved() || foe) {
    return
  }
  store.dispatch("game/move", { stack: selectionStore.focusedStack, hex })
  deselectStack()
}
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
