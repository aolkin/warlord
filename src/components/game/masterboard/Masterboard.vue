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
          v-if="paths.length > 0"
          :key="selectedStack!.hex"
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
import { useSelectionStore } from "~/stores/selection"
import { usePreferencesStore } from "~/stores/ui/preferences"
import StackPanel from "../../ui/game/StackPanel.vue"
import TurnPanel from "../../ui/game/TurnPanel.vue"
import MasterboardHexComponent from "./MasterboardHex.vue"
import MasterboardHexes from "./MasterboardHexes.vue"
import MasterboardStack from "./MasterboardStack.vue"

defineOptions({ name: "Masterboard" })

let lastSortedStacks: Stack[] = []

const preferencesStore = usePreferencesStore()
const selectionStore = useSelectionStore()
const store = useTypedStore()

const activePhase = computed(() => store.state.game.activePhase)
const stacks = computed(() => store.state.game.stacks)
// activeRoll and selectedStack are only read from template branches that are
// only rendered once the selection store's "paths" getter is non-empty, which itself
// requires both to be defined - see src/stores/selection.ts.
const activeRoll = computed(() => store.state.game.activeRoll!)
const paths = computed((): Path[] => selectionStore.paths)
const focusedStack = computed((): Stack | undefined => selectionStore.focusedStack)
const selectedStack = computed((): Stack | undefined => selectionStore.selectedStack)

const sortedStacks = computed((): Stack[] => {
  lastSortedStacks = sortBy(stacks.value, stack =>
    stack === selectedStack.value ? 999 : lastSortedStacks.indexOf(stack))
  return lastSortedStacks
})
const interleavedPaths = computed((): [boolean, MasterboardHex][][] =>
  range(paths.value[0].path.length).map((colIndex: number) =>
    paths.value.map((row: Path): [boolean, MasterboardHex] =>
      [row.foe !== undefined, row.path[colIndex]])).slice(1))

const canFreeMove = computed((): boolean =>
  activePhase.value === MasterboardPhase.MOVE &&
  focusedStack.value !== undefined && preferencesStore.freeMovement)

function deselectStack(): void {
  selectionStore.deselectStack()
}

function moveStack(distance: number, foe: boolean, hex: MasterboardHex): void {
  if (distance !== activeRoll.value - 1 || focusedStack.value?.hasMoved() || foe) {
    return
  }
  store.dispatch("game/move", { stack: focusedStack.value, hex })
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
