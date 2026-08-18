<template>
  <v-card
    border
    width="300"
    :prepend-icon="icon"
    :title="`${game.players[game.activePlayerIndex].name}'s Turn`"
  >
    <template #prepend>
      <v-icon size="x-large" />
    </template>
    <v-card-text v-if="TitanGame.isSplitPhase(game)">
      <span v-if="TitanGame.getMayProceed(game)">
        Split stacks if desired, or proceed to roll.
        <span v-if="sevenHighCount > 0">
          You have {{ sevenHighCount }} full stack{{ sevenHighCount > 1 ? "s" : "" }}!
        </span>
      </span>
      <span v-else>You must adjust your stack splits before rolling.</span>
    </v-card-text>
    <v-card-text v-else-if="TitanGame.isMovePhase(game)">
      Moved {{ movedCount }} of {{ gameStore.activeStacks.length }} stacks.
      {{ engagementsMessage }}
      <span v-if="movedCount < 1">You must move at least one stack!</span>
      <span v-else-if="!TitanGame.getMayProceed(game)">
        You must move at least one stack from each split if possible.
      </span>
    </v-card-text>
    <v-card-text v-else-if="TitanGame.isMusterPhase(game)">
      Mustered a recruit in {{ musteredCount }} of {{ gameStore.activeStacks.length }} stacks.
    </v-card-text>
    <v-fade-transition leave-absolute>
      <v-card-actions v-if="TitanGame.isSplitPhase(game)">
        <v-btn
          block
          :disabled="!TitanGame.getMayProceed(game)"
          variant="outlined"
          @click="proceedToRoll"
        >
          Finish Splits and Roll
        </v-btn>
      </v-card-actions>
      <v-card-actions v-else-if="TitanGame.isMovePhase(game)">
        <v-btn
          v-if="TitanGame.isMulliganAvailable(game)"
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
          :variant="movedCount === gameStore.activeStacks.length ? 'outlined' : 'tonal'"
          :disabled="!TitanGame.getMayProceed(game)"
          @click="TitanGame.nextPhase(game)"
        >
          {{ TitanGame.getEngagedStacks(game).length > 0 ? "Proceed to Battle" : "Proceed to Muster" }}
        </v-btn>
      </v-card-actions>
      <v-card-actions v-else-if="TitanGame.isMusterPhase(game)">
        <v-btn
          block
          variant="outlined"
          :disabled="!TitanGame.getMayProceed(game)"
          @click="TitanGame.nextPhase(game)"
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
import { MasterboardPhase, TitanGame } from "@/models/game"
import { Moveable } from "@/models/moveable"
import { useGameStore } from "~/stores/game"

const diceRoller = inject<Readonly<Ref<InstanceType<typeof DiceRoller> | null>>>("diceRoller")

const gameStore = useGameStore()
const game = gameStore.game

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
const movedCount = computed(() => sum(gameStore.activeStacks.map(stack => Moveable.hasMoved(stack))))
const musteredCount = computed(() => sum(gameStore.activeStacks.map(stack => stack.currentMuster !== undefined)))
const engagementsMessage = computed(() => {
  const engagedStacks = TitanGame.getEngagedStacks(game)
  if (engagedStacks.length < 1) {
    return ""
  } else if (engagedStacks.length === 1) {
    return "1 pending battle."
  } else {
    return `${engagedStacks.length} pending battles.`
  }
})

function roll(): void {
  if (game.activeRoll !== undefined) {
    TitanGame.setRoll(game, undefined)
  }
  diceRoller?.value?.roll().then((rolled: number[]) => TitanGame.setRoll(game, rolled[0]))
}

function proceedToRoll(): void {
  TitanGame.nextPhase(game)
  roll()
}
</script>

<style scoped lang="sass"></style>
