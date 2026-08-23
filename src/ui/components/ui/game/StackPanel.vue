<template>
  <v-expand-transition>
    <v-card
      v-if="props.focusedStack === undefined"
      border
      width="342"
      subtitle="Hover over a stack to view details..."
    />
    <v-card
      v-else
      :elevation="props.focusedStack === selectionStore.selectedStack ? 5 : 0"
      class="root-card"
      border
      width="342"
    >
      <v-card-actions
        v-if="selectionStore.selectedStack === props.focusedStack"
        class="justify-space-between"
      >
        <v-btn @click="cycleStacks(-1)">Previous Stack</v-btn>
        <v-btn @click="cycleStacks(1)">Next Stack</v-btn>
      </v-card-actions>
      <v-card-item :title="`${stackPlayer?.name} (${props.focusedStack.creatures.length} creatures)`">
        <template #prepend>
          <PlayerMarker
            :color="props.focusedStack.owner"
            :marker="props.focusedStack.marker"
            width="50"
            height="50"
          />
        </template>
      </v-card-item>

      <div class="px-2 pb-1">
        <Creature
          v-for="(creature, index) in props.focusedStack.creatures"
          :key="index"
          :type="creature"
          :player-id="props.focusedStack.owner"
          :class="{
            splitting: stagedSplit.includes(index),
            interactive: splittable,
          }"
          class="ma-1"
          @click="stackSplitsStore.toggle(props.focusedStack.id, index)"
        />
      </div>
      <template v-if="game.activePlayerId === props.focusedStack.owner">
        <v-card-actions
          v-if="TitanGame.isSplitPhase(game)"
          class="split-guide"
        >
          <v-card-text v-if="game.round === 0">
            You must split your starting creatures. Please select four creatures (including one lord) above to split
            into a separate stack.
            <div
              v-if="Stack.isValidSplit(props.focusedStack, stagedSplit, game.round === 0)"
              class="first-round-success"
            >
              You have selected a valid split and may roll the die to start your turn!
            </div>
          </v-card-text>
          <v-card-text v-else-if="props.focusedStack.creatures.length < 4">
            You do not have enough creatures to split this stack.
          </v-card-text>
          <v-card-text v-else>
            You may select at least 2 and at most
            {{ props.focusedStack.creatures.length - 2 }} creatures to split into a new stack.
            <div
              v-if="stagedSplit.length > 0"
              class="text-left mt-5"
            >
              <p>Remaining: {{ stayingCreatureNames }}</p>
              <p>Splitting: {{ splittingCreatureNames }}</p>
            </div>
          </v-card-text>
        </v-card-actions>
        <template
          v-else-if="
            TitanGame.isMusterPhase(game) ||
            (TitanGame.isMovePhase(game) &&
              selectionStore.focusedHex !== undefined &&
              props.focusedStack.hex !== selectionStore.focusedHex.id)
          "
        >
          <v-card-title>Mustering Options ({{ musteringTerrainName }})</v-card-title>
          <MusterChoices
            v-if="TitanGame.isMovePhase(game) || Stack.canMuster(props.focusedStack)"
            v-model="mustering"
            class="px-2 pb-1"
            :can-decline="TitanGame.isMusterPhase(game)"
            :musterable="musterable"
            :player-id="props.focusedStack.owner"
          />
          <v-card-subtitle
            v-if="TitanGame.isMusterPhase(game)"
            class="mb-3"
          >
            {{ musteringCaption }}
          </v-card-subtitle>
        </template>
      </template>
    </v-card>
  </v-expand-transition>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { capitalize } from "lodash-es"
import { CREATURE_DATA, CreatureType } from "@/models/creature"
import { TitanGame } from "@/models/game"
import masterboard, { Terrain } from "@/models/masterboard"
import { Moveable } from "@/models/moveable"
import { Player } from "@/models/player"
import { MusterChoice, MusterPossibility, Stack } from "@/models/stack"
import { useGameStore } from "~/stores/game"
import { useSelectionStore } from "~/stores/ui/selection"
import { useStackSplitsStore } from "~/stores/ui/stackSplits"
import { mod } from "~/utils/math"
import Creature from "../../game/Creature.vue"
import PlayerMarker from "../../game/Marker.vue"
import MusterChoices from "./MusterChoices.vue"

const props = defineProps<{
  focusedStack: Stack | undefined
}>()

const gameStore = useGameStore()
const game = gameStore.game
const selectionStore = useSelectionStore()
const stackSplitsStore = useStackSplitsStore()

const splittable = computed(
  (): boolean => props.focusedStack !== undefined && gameStore.isSplittable(props.focusedStack.id),
)

const stagedSplit = computed((): number[] =>
  props.focusedStack === undefined ? [] : stackSplitsStore.splittingIndices(props.focusedStack.id),
)

const stackPlayer = computed((): Player | undefined =>
  props.focusedStack === undefined ? undefined : TitanGame.getPlayerById(game, props.focusedStack.owner),
)

const musteringTerrain = computed((): Terrain =>
  TitanGame.isMusterPhase(game)
    ? masterboard.getHex(props.focusedStack?.hex as number).terrain
    : (selectionStore.focusedHex?.terrain as Terrain),
)

const musteringTerrainName = computed((): string => capitalize(Terrain[musteringTerrain.value]))

const musterable = computed((): MusterPossibility[] =>
  props.focusedStack !== undefined ? Stack.musterable(props.focusedStack, musteringTerrain.value) : [],
)

const stayingCreatureNames = computed((): string =>
  Stack.getStayingCreatures(props.focusedStack!, stagedSplit.value)
    .map((c: CreatureType) => CREATURE_DATA[c].name)
    .join(", "),
)

const splittingCreatureNames = computed((): string =>
  Stack.getSplittingCreatures(props.focusedStack!, stagedSplit.value)
    .map((c: CreatureType) => CREATURE_DATA[c].name)
    .join(", "),
)

const mustering = computed({
  get() {
    return props.focusedStack?.currentMuster
  },
  set(value: MusterChoice) {
    if (!TitanGame.isMusterPhase(game)) {
      return
    }
    TitanGame.setRecruit(game, { stack: props.focusedStack!.id, recruit: value })
  },
})

const musteringCaption = computed(() => {
  const stack = props.focusedStack!
  if (!Moveable.hasMoved(stack)) {
    return "You cannot muster in a stack that did not move this turn."
  } else if (Stack.isFull(stack)) {
    return "This stack is already full and cannot muster."
  } else if (stack.currentMuster === undefined) {
    return "No recruit chosen."
  } else {
    let caption = "Mustering " + CREATURE_DATA[stack.currentMuster[0] as CreatureType].name
    if (stack.currentMuster[1][1] > 0) {
      caption += " with "
      if (stack.currentMuster[1][1] > 1) {
        caption += `${stack.currentMuster[1][1]}x `
      }
      caption += CREATURE_DATA[stack.currentMuster[1][0] as CreatureType].name
    }
    return caption
  }
})

function cycleStacks(by: number): void {
  let index = gameStore.activeStacks.indexOf(selectionStore.requireSelectedStack())
  let candidateStack: Stack
  do {
    index += by
    candidateStack = gameStore.activeStacks[mod(index, gameStore.activeStacks.length)]
  } while (!TitanGame.isStackActive(game, candidateStack))
  selectionStore.selectStack(candidateStack)
}
</script>

<style scoped lang="sass">
.root-card
  transition: .2s ease-out

.interactive
  cursor: pointer

.splitting
  outline: 4px dashed rgb(var(--v-theme-primary))
  outline-offset: -2px

.split-guide .v-card-text
  text-align: center

  p
    margin: 0

  .first-round-success
    font-size: 1.1em
    margin-top: 1em
    color: rgb(var(--v-theme-secondary))
</style>
