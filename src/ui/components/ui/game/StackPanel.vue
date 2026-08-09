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
        <v-btn @click="cycleStacks(-1)">
          Previous Stack
        </v-btn>
        <v-btn @click="cycleStacks(1)">
          Next Stack
        </v-btn>
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
          v-for="(creature, index) in (props.focusedStack.creatures as CreatureType[])"
          :key="index"
          :type="creature"
          :player="stackPlayer"
          :class="{ splitting: props.focusedStack.split[index],
                    interactive: activePhase === MasterboardPhase.SPLIT && owned }"
          class="ma-1"
          @click="toggleSplit(index)"
        />
      </div>
      <template v-if="activePlayerId === props.focusedStack.owner">
        <v-card-actions
          v-if="activePhase === MasterboardPhase.SPLIT"
          class="split-guide"
        >
          <v-card-text v-if="firstRound">
            You must split your starting creatures. Please select four creatures (including one lord) above
            to split into a separate stack.
            <div
              v-if="props.focusedStack?.isValidSplit(firstRound)"
              class="first-round-success"
            >
              You have selected a valid split and may roll the die
              to start your turn!
            </div>
          </v-card-text>
          <v-card-text v-else-if="props.focusedStack.creatures.length < 4">
            You do not have enough creatures to split this stack.
          </v-card-text>
          <v-card-text v-else>
            You may select at least 2 and at most {{ props.focusedStack.creatures.length - 2 }} creatures
            to split into a new stack.
            <div
              v-if="props.focusedStack.getCreaturesSplit(true).length > 0"
              class="text-left mt-5"
            >
              <p>
                Remaining: {{ props.focusedStack.getCreaturesSplit(false)
                  .map((c: CreatureType) => CREATURE_DATA[c].name).join(", ") }}
              </p>
              <p>
                Splitting: {{ props.focusedStack.getCreaturesSplit(true)
                  .map((c: CreatureType) => CREATURE_DATA[c].name).join(", ") }}
              </p>
            </div>
          </v-card-text>
        </v-card-actions>
        <template
          v-else-if="activePhase === MasterboardPhase.MUSTER ||
            (activePhase === MasterboardPhase.MOVE &&
              selectionStore.focusedHex !== undefined && props.focusedStack.hex !== selectionStore.focusedHex.id)"
        >
          <v-card-title>Mustering Options ({{ musteringTerrainName }})</v-card-title>
          <MusterChoices
            v-if="activePhase === MasterboardPhase.MOVE || props.focusedStack.canMuster()"
            v-model="mustering"
            class="px-2 pb-1"
            :can-decline="activePhase === MasterboardPhase.MUSTER"
            :musterable="musterable"
            :player="stackPlayer"
          />
          <v-card-subtitle
            v-if="activePhase === MasterboardPhase.MUSTER"
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
import { MasterboardPhase } from "@/models/game"
import masterboard, { Terrain } from "@/models/masterboard"
import { Player } from "@/models/player"
import { MusterChoice, MusterPossibility, Stack, togglePendingSplit } from "@/models/stack"
import { useGameStore } from "~/stores/game"
import { useSelectionStore } from "~/stores/ui/selection"
import { mod } from "~/utils/math"
import Creature from "../../game/Creature.vue"
import PlayerMarker from "../../game/Marker.vue"
import MusterChoices from "./MusterChoices.vue"

const props = defineProps<{
  focusedStack: Stack | undefined
}>()

const gameStore = useGameStore()
const selectionStore = useSelectionStore()

const activePhase = computed(() => gameStore.game.activePhase)
const activePlayerId = computed(() => gameStore.activePlayerId)
const firstRound = computed(() => gameStore.firstRound)

const owned = computed((): boolean => activePlayerId.value === props.focusedStack?.owner)

const stackPlayer = computed((): Player | undefined => props.focusedStack === undefined
  ? undefined
  : gameStore.game.getPlayerById(props.focusedStack.owner))

const musteringTerrain = computed((): Terrain => activePhase.value === MasterboardPhase.MUSTER
  ? masterboard.getHex(props.focusedStack?.hex as number).terrain
  : selectionStore.focusedHex?.terrain as Terrain)

const musteringTerrainName = computed((): string => capitalize(Terrain[musteringTerrain.value]))

const musterable = computed((): MusterPossibility[] =>
  props.focusedStack?.musterable(musteringTerrain.value) as MusterPossibility[])

const mustering = computed({
  get() {
    return props.focusedStack?.currentMuster
  },
  set(value: MusterChoice) {
    if (activePhase.value !== MasterboardPhase.MUSTER) {
      return
    }
    void gameStore.game.doSetRecruit({ stack: props.focusedStack!, recruit: value })
  }
})

const musteringCaption = computed(() => {
  const stack = props.focusedStack!
  if (!stack.canMuster()) {
    if (!stack.hasMoved()) {
      return "You cannot muster in a stack that did not move this turn."
    } else if (stack.creatures.length > 6) {
      return "This stack is already full and cannot muster."
    } else {
      return "This stack cannot muster."
    }
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

function toggleSplit(index: number): void {
  if (activePhase.value === MasterboardPhase.SPLIT &&
    (props.focusedStack?.creatures.length ?? 0) > 2) {
    const stack = props.focusedStack!
    togglePendingSplit(stack, index)
  }
}

function cycleStacks(by: number): void {
  let index = gameStore.activeStacks.indexOf(selectionStore.requireSelectedStack())
  let candidateStack: Stack
  do {
    index += by
    candidateStack = gameStore.activeStacks[mod(index, gameStore.activeStacks.length)]
  } while ((activePhase.value === MasterboardPhase.MOVE && candidateStack.hasMoved()) ||
  (activePhase.value === MasterboardPhase.MUSTER && !candidateStack.canMuster()))
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
