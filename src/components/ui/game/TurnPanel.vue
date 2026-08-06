<template>
  <v-card
    border
    width="300"
    :prepend-icon="icon"
    :title="`${activePlayer.name}'s Turn`"
  >
    <template #prepend>
      <v-icon size="x-large" />
    </template>
    <v-card-text v-if="activePhase === MasterboardPhase.SPLIT">
      <span v-if="mayProceed">
        Split stacks if desired, or proceed to roll.
        <span v-if="sevenHighCount > 0">
          You have {{ sevenHighCount }} full stack{{ sevenHighCount > 1 ? 's' : '' }}!
        </span>
      </span>
      <span v-else>
        You must adjust your stack splits before rolling.
      </span>
    </v-card-text>
    <v-card-text v-else-if="activePhase === MasterboardPhase.MOVE">
      Moved {{ movedCount }} of {{ activeStacks.length }} stacks. {{ engagementsMessage }}
      <span v-if="movedCount < 1">
        You must move at least one stack!
      </span>
      <span v-else-if="!mayProceed">
        You must move at least one stack from each split if possible.
      </span>
    </v-card-text>
    <v-card-text v-else-if="activePhase === MasterboardPhase.MUSTER">
      Mustered a recruit in {{ musteredCount }} of {{ activeStacks.length }} stacks.
    </v-card-text>
    <v-fade-transition leave-absolute>
      <v-card-actions v-if="activePhase === MasterboardPhase.SPLIT">
        <v-btn
          block
          :disabled="!mayProceed"
          variant="outlined"
          @click="proceedToRoll"
        >
          Finish Splits and Roll
        </v-btn>
      </v-card-actions>
      <v-card-actions v-else-if="activePhase === MasterboardPhase.MOVE">
        <v-btn
          v-if="mulliganAvailable"
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
          :variant="movedCount === activeStacks.length ? 'outlined' : 'tonal' "
          :disabled="!mayProceed"
          @click="nextPhase"
        >
          {{ engagedStacks.length > 0 ? "Proceed to Battle" : "Proceed to Muster" }}
        </v-btn>
      </v-card-actions>
      <v-card-actions v-else-if="activePhase === MasterboardPhase.MUSTER">
        <v-btn
          block
          variant="outlined"
          :disabled="!mayProceed"
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
import { useStore } from "vuex"
import DiceRoller from "~/components/ui/generic/DiceRoller"
import { MasterboardPhase } from "~/models/game"
import { Stack } from "~/models/stack"
import { useSelectionStore } from "~/stores/selection"

defineOptions({ name: "TurnPanel" })

const diceRoller = inject<Readonly<Ref<InstanceType<typeof DiceRoller> | null>>>("diceRoller")

const store = useStore()
const selectionStore = useSelectionStore()

const activeRoll = computed<number | undefined>(() => store.state.game.activeRoll)
const activePhase = computed<MasterboardPhase>(() => store.state.game.activePhase)
const activePlayer = computed(() => store.getters["game/activePlayer"])
const activeStacks = computed<Stack[]>(() => store.getters["game/activeStacks"])
const mayProceed = computed<boolean>(() => store.getters["game/mayProceed"])
const mulliganAvailable = computed<boolean>(() => store.getters["game/mulliganAvailable"])
const engagedStacks = computed<Stack[]>(() => store.getters["game/engagedStacks"])

const icon = computed(() => {
  switch (activePhase.value) {
    case MasterboardPhase.SPLIT:
      return "mdi-call-split"
    case MasterboardPhase.MOVE:
      return `mdi-dice-${activeRoll.value ?? "multiple"}`
    case MasterboardPhase.BATTLE:
      return "mdi-sword-cross"
    case MasterboardPhase.MUSTER:
      return "mdi-account-multiple-plus"
    default:
      return "mdi-dice-multiple"
  }
})
const sevenHighCount = computed(() => sum(activeStacks.value.map(stack => stack.creatures.length === 7)))
const movedCount = computed(() => sum(activeStacks.value.map(stack => stack.hasMoved())))
const musteredCount = computed(() => sum(activeStacks.value.map(stack => stack.currentMuster !== undefined)))
const engagementsMessage = computed(() => {
  if (engagedStacks.value.length < 1) {
    return ""
  } else if (engagedStacks.value.length === 1) {
    return "1 pending battle."
  } else {
    return `${engagedStacks.value.length} pending battles.`
  }
})

function setRoll(payload?: number): Promise<void> {
  return store.dispatch("game/setRoll", payload)
}

function nextPhase(): void {
  void store.dispatch("game/nextPhase")
}

function roll(): void {
  if (activeRoll.value !== undefined) {
    void setRoll(undefined)
  }
  diceRoller?.value?.roll().then(async(rolled: number[]) => await setRoll(rolled[0]))
}

function proceedToRoll(): void {
  selectionStore.deselectStack()
  nextPhase()
  roll()
}
</script>

<style scoped lang="sass">

</style>
