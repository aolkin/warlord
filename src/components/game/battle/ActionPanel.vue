<template>
  <v-card
    width="300"
    :title="`${playerById(battleActivePlayer).name}'s Turn`"
  >
    <template #prepend>
      <v-icon
        :icon="roundIcon"
        size="x-large"
        :title="`Round ${activeBattle.round + 1}`"
      />
      <v-icon
        :icon="phaseIcon"
        size="large"
        :title="phaseTypeTitle"
      />
    </template>
    <v-card-subtitle v-if="preferencesStore.debugUi">
      Hex: {{ focusedBattleHex }} ({{ Hazard[land.getHazard(focusedBattleHex!)] }})
      <span v-if="land.getElevation(focusedBattleHex!) > 0">+{{ land.getElevation(focusedBattleHex!) }}</span>
    </v-card-subtitle>
    <v-card-text v-if="battlePhaseType === BattlePhaseType.MOVE && pendingCreatures > 0">
      You have {{ pendingCreatures }} creature{{ pendingCreatures > 1 ? 's' : '' }} that
      {{ pendingCreatures > 1 ? 'have' : 'has' }} not entered the battle board. If they do
      not do so this round, they will be eliminated.
    </v-card-text>
    <v-card-text v-if="pendingStrikes.length > 0">
      You have {{ pendingStrikes.length }} creature{{ pendingStrikes.length > 1 ? 's' : '' }} that
      {{ pendingStrikes.length > 1 ? 'have' : 'has' }} not yet struck. Every creature that can strike
      must do so.
    </v-card-text>
    <v-fade-transition
      leave
      absolute
    >
      <v-card-actions>
        <v-btn
          block
          variant="outlined"
          :disabled="!mayProceed"
          @click="nextPhase"
        >
          End {{ phaseTypeTitle }}
        </v-btn>
      </v-card-actions>
    </v-fade-transition>
  </v-card>
</template>
<script setup lang="ts">
import { computed } from "vue"
import {
  BattleBoard,
  BattleCreature,
  BattlePhaseType,
  Hazard
} from "~/models/battle"
import { useTypedStore } from "~/plugins/vuex"
import { useSelectionStore } from "~/stores/selection"
import { usePreferencesStore } from "~/stores/ui/preferences"

const store = useTypedStore()
const selectionStore = useSelectionStore()
const preferencesStore = usePreferencesStore()

// ActionPanel only renders inside BattleBoard's v-else branch (active battle present).
const activeBattle = computed(() => store.state.game.activeBattle!)
const focusedBattleHex = computed(() => selectionStore.focusedBattleHex)
const battlePhaseType = computed((): BattlePhaseType => store.getters["game/battlePhaseType"])
const battleActivePlayer = computed(() => store.getters["game/battleActivePlayer"])
const playerById = computed(() => store.getters["game/playerById"])
const battleCarryoverTargets = computed(() => store.getters["game/battleCarryoverTargets"])

const phaseTypeTitle = computed((): string => {
  switch (battlePhaseType.value) {
    case BattlePhaseType.MOVE:
      return "Movement"
    case BattlePhaseType.STRIKE:
      return "Strikes"
    case BattlePhaseType.STRIKEBACK:
      return "Strikebacks"
    default:
      return "Unknown"
  }
})

const phaseIcon = computed((): string => {
  switch (battlePhaseType.value) {
    case BattlePhaseType.MOVE:
      return "mdi-cursor-move"
    case BattlePhaseType.STRIKE:
      return "mdi-sword"
    case BattlePhaseType.STRIKEBACK:
      return "mdi-shield-sword"
    default:
      return ""
  }
})

const pendingStrikes = computed((): BattleCreature[] => {
  if (battlePhaseType.value === BattlePhaseType.STRIKE ||
    battlePhaseType.value === BattlePhaseType.STRIKEBACK) {
    return activeBattle.value.getPendingStrikes()
  } else {
    return []
  }
})

const mayProceed = computed((): boolean =>
  pendingStrikes.value.length === 0 && !battleCarryoverTargets.value)

const roundIcon = computed((): string => {
  const name = `mdi-numeric-${activeBattle.value.round + 1}-box`
  return name + (battleActivePlayer.value === activeBattle.value.defender ? "-outline" : "")
})

const land = computed((): BattleBoard => activeBattle.value.getBoard())

const pendingCreatures = computed((): number =>
  activeBattle.value.creatures.filter((creature: BattleCreature) =>
    creature.player === battleActivePlayer.value && creature.hex >= 36).length)

function nextPhase(): void {
  selectionStore.deselectCreature()
  store.dispatch("game/nextBattlePhase")
}
</script>
<style scoped lang="sass">
@import "@/styles/terrain-colors.sass"

@include battlemap-colors(".board :deep(.hex)", fill)

</style>
