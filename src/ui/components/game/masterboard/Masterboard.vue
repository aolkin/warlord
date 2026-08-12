<template>
  <div class="root">
    <svg
      class="board"
      viewBox="-400 -350 800 700"
      xmlns="http://www.w3.org/2000/svg"
      @click="selectionStore.deselectStack"
    >
      <MasterboardHexes :can-free-move="canFreeMove" />
      <v-fade-transition>
        <g
          v-if="paths.length > 0"
          :key="selectionStore.selectedStack!.hex"
          class="paths"
        >
          <g
            v-for="(step, distance) in interleavedPaths"
            :key="distance"
          >
            <MasterboardPathOverlay
              v-for="([foe, hex], index) in step"
              :key="hex.id"
              :contains-enemy="foe"
              :hex="hex"
              :path-index="index"
              :path-length="activeRoll!"
              :position-on-path="distance"
              @click.stop="moveStack(distance, foe, hex.id)"
            />
          </g>
        </g>
      </v-fade-transition>
      <g class="stacks">
        <MasterboardStack
          v-for="stack in sortedStacks"
          :key="stack.id"
          :stack="stack"
          :paths="paths"
          @enter="enterStack"
          @leave="leaveStack"
        />
      </g>
    </svg>
    <StackPanel
      class="ma-3"
      position="fixed"
      location="top right"
      :focused-stack="focusedStack"
    />
    <TurnPanel
      class="ma-3 mb-10"
      position="fixed"
      location="bottom right"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, shallowReactive } from "vue"
import { range, sortBy } from "lodash-es"
import { Path, TitanGame } from "@/models/game"
import masterboard, { MasterboardHex } from "@/models/masterboard"
import { Moveable } from "@/models/moveable"
import { Stack } from "@/models/stack"
import { useGameStore } from "~/stores/game"
import { usePreferencesStore } from "~/stores/ui/preferences"
import { useSelectionStore } from "~/stores/ui/selection"
import StackPanel from "../../ui/game/StackPanel.vue"
import TurnPanel from "../../ui/game/TurnPanel.vue"
import MasterboardHexes from "./MasterboardHexes.vue"
import MasterboardPathOverlay from "./MasterboardPathOverlay.vue"
import MasterboardStack from "./MasterboardStack.vue"

let lastSortedStacks: Stack[] = []

const game = useGameStore().game
const preferencesStore = usePreferencesStore()
const selectionStore = useSelectionStore()

// activeRoll is only read from template branches that are only rendered once "paths"
// below is non-empty, which itself requires activeRoll to be defined.
const activeRoll = computed(() => game.activeRoll!)

const paths = computed<Path[]>(() => {
  if (selectionStore.selectedStack?.hex === undefined ||
    masterboard.getHex(selectionStore.selectedStack.hex) === undefined ||
    game.activeRoll === undefined) {
    return []
  }
  return TitanGame.getPathsForHex(game, selectionStore.selectedStack.hex)
})

// Stack instances here always come from the game store's own reactive state, so they're
// already reactive proxies by the time they reach this array - a shallow collection avoids
// Vue re-wrapping their internals a second time, which for a class with private fields also
// trips up TypeScript (Vue's deep UnwrapRef can't reconstruct a private field, so the mapped
// type stops matching the class).
const focusedStacks = shallowReactive<Stack[]>([])

const focusedStack = computed<Stack | undefined>(() => focusedStacks.length > 0
  ? focusedStacks[focusedStacks.length - 1]
  : selectionStore.selectedStack)

function enterStack(entering: Stack): void {
  if (!focusedStacks.includes(entering)) {
    focusedStacks.push(entering)
  }
}

function leaveStack(leaving: Stack): void {
  const index = focusedStacks.indexOf(leaving)
  if (index !== -1) {
    focusedStacks.splice(index)
  }
}

const sortedStacks = computed((): Stack[] => {
  lastSortedStacks = sortBy(game.stacks, stack =>
    stack === selectionStore.selectedStack ? 999 : lastSortedStacks.indexOf(stack))
  return lastSortedStacks
})
const interleavedPaths = computed((): [boolean, MasterboardHex][][] =>
  range(paths.value[0].path.length).map((colIndex: number) =>
    paths.value.map((row: Path): [boolean, MasterboardHex] =>
      [row.foe !== undefined, row.path[colIndex]])).slice(1))

const canFreeMove = computed((): boolean =>
  TitanGame.isMovePhase(game) &&
  selectionStore.selectedStack !== undefined && preferencesStore.freeMovement)

function moveStack(distance: number, foe: boolean, hex: number): void {
  const stack = selectionStore.selectedStack
  if (distance !== activeRoll.value - 1 || stack === undefined || Moveable.hasMoved(stack) || foe) {
    return
  }
  void TitanGame.move(game, { stack: stack.id, hex })
  selectionStore.deselectStack()
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
