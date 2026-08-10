<template>
  <v-card
    border
    width="300"
    :prepend-icon="icon"
    :title="`${game.getActivePlayer().name}'s Turn`"
  >
    <template #prepend>
      <v-icon size="x-large" />
    </template>
    <v-card-text v-if="game.isSplitPhase()">
      <span v-if="game.getMayProceed()">
        Split stacks if desired, or proceed to roll.
        <span v-if="sevenHighCount > 0">
          You have {{ sevenHighCount }} full stack{{ sevenHighCount > 1 ? 's' : '' }}!
        </span>
      </span>
      <span v-else>
        You must adjust your stack splits before rolling.
      </span>
    </v-card-text>
    <v-card-text v-else-if="game.isMovePhase()">
      Moved {{ movedCount }} of {{ gameStore.activeStacks.length }} stacks. {{ engagementsMessage }}
      <span v-if="movedCount < 1">
        You must move at least one stack!
      </span>
      <span v-else-if="!game.getMayProceed()">
        You must move at least one stack from each split if possible.
      </span>
    </v-card-text>
    <v-card-text v-else-if="game.isMusterPhase()">
      Mustered a recruit in {{ musteredCount }} of {{ gameStore.activeStacks.length }} stacks.
    </v-card-text>
    <v-fade-transition leave-absolute>
      <v-card-actions v-if="game.isSplitPhase()">
        <v-btn
          block
          :disabled="!game.getMayProceed()"
          variant="outlined"
          @click="proceedToRoll"
        >
          Finish Splits and Roll
        </v-btn>
      </v-card-actions>
      <v-card-actions v-else-if="game.isMovePhase()">
        <v-btn
          v-if="game.isMulliganAvailable()"
          block
          variant="outlined"
          title="On the first round only, you may opt to re-roll your die once."
          @click="roll"
        >
          Mulligan (Roll Again)
        </v-btn>
        <v-btn
          v-else
          block
          :variant="movedCount === gameStore.activeStacks.length ? 'outlined' : 'tonal' "
          :disabled="!game.getMayProceed()"
          @click="nextPhase"
        >
          {{ game.getEngagedStacks().length > 0 ? "Proceed to Battle" : "Proceed to Muster" }}
        </v-btn>
      </v-card-actions>
      <v-card-actions v-else-if="game.isMusterPhase()">
        <v-btn
          block
          variant="outlined"
          :disabled="!game.getMayProceed()"
          @click="nextPhase"
        >
          End Turn
        </v-btn>
      </v-card-actions>
    </v-fade-transition>
  </v-card>
</template>

<script setup lang="ts">
import { computed, inject, Ref } from "vue"
import { sum } from "lodash-es"
import type DiceRoller from "~/components/ui/generic/DiceRoller"
import { MasterboardPhase } from "@/models/game"
import { useGameStore } from "~/stores/game"
import { useSelectionStore } from "~/stores/ui/selection"

const diceRoller = inject<Readonly<Ref<InstanceType<typeof DiceRoller> | null>>>("diceRoller")

const gameStore = useGameStore()
const game = gameStore.game
const selectionStore = useSelectionStore()

const icon = computed(() => {
  switch (game.activePhase) {
    case MasterboardPhase.SPLIT:
      return "mdi-call-split"
    case MasterboardPhase.MOVE:
      return `mdi-dice-${game.activeRoll ?? "multiple"}`
    case MasterboardPhase.BATTLE:
      return "mdi-sword-cross"
    case MasterboardPhase.MUSTER:
      return "mdi-account-multiple-plus"
    default:
      return "mdi-dice-multiple"
  }
})
const sevenHighCount = computed(() => sum(gameStore.activeStacks.map(stack => stack.creatures.length === 7)))
const movedCount = computed(() => sum(gameStore.activeStacks.map(stack => stack.hasMoved())))
const musteredCount = computed(() =>
  sum(gameStore.activeStacks.map(stack => stack.currentMuster !== undefined)))
const engagementsMessage = computed(() => {
  const engagedStacks = game.getEngagedStacks()
  if (engagedStacks.length < 1) {
    return ""
  } else if (engagedStacks.length === 1) {
    return "1 pending battle."
  } else {
    return `${engagedStacks.length} pending battles.`
  }
})

function nextPhase(): void {
  void game.nextPhase()
}

function roll(): void {
  if (game.activeRoll !== undefined) {
    void game.setRoll(undefined)
  }
  diceRoller?.value?.roll().then(async(rolled: number[]) => await game.setRoll(rolled[0]))
}

function proceedToRoll(): void {
  selectionStore.deselectStack()
  nextPhase()
  roll()
}
</script>

<style scoped lang="sass">

</style>
