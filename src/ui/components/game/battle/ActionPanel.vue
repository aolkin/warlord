<template>
  <v-card
    width="300"
    :title="`${battleActivePlayer.name}'s Turn`"
  >
    <template #prepend>
      <v-icon
        :icon="roundIcon"
        size="x-large"
        :title="`Round ${battle.round + 1}`"
      />
      <v-icon
        :icon="phaseIcon"
        size="large"
        :title="phaseTypeTitle"
      />
    </template>
    <v-card-subtitle v-if="preferencesStore.debugUi && selectionStore.focusedBattleHex !== undefined">
      Hex: {{ selectionStore.focusedBattleHex }} ({{ Hazard[land.getHazard(selectionStore.focusedBattleHex!)] }})
      <span v-if="land.getElevation(selectionStore.focusedBattleHex!) > 0">+{{ land.getElevation(selectionStore.focusedBattleHex!) }}</span>
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
  Battle,
  BattleBoard,
  BattleCreature,
  BattlePhaseType,
  Hazard
} from "@/models/battle"
import { PlayerId } from "@/models/player"
import { useGameStore } from "~/stores/game"
import { usePreferencesStore } from "~/stores/ui/preferences"
import { useSelectionStore } from "~/stores/ui/selection"

const props = defineProps<{
  battle: Battle
}>()

const gameStore = useGameStore()
const selectionStore = useSelectionStore()
const preferencesStore = usePreferencesStore()

const battlePhaseType = computed(() => gameStore.battlePhaseType)
const battleActivePlayerId = computed((): PlayerId => props.battle.getActivePlayer())
const battleActivePlayer = computed(() => gameStore.playerById(battleActivePlayerId.value))

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
    return props.battle.getPendingStrikes()
  } else {
    return []
  }
})

const mayProceed = computed((): boolean =>
  pendingStrikes.value.length === 0 && !gameStore.battleCarryoverTargets)

const roundIcon = computed((): string => {
  const name = `mdi-numeric-${props.battle.round + 1}-box`
  return name + (battleActivePlayerId.value === props.battle.defender ? "-outline" : "")
})

const land = computed((): BattleBoard => props.battle.getBoard())

const pendingCreatures = computed((): number =>
  props.battle.creatures.filter((creature: BattleCreature) =>
    creature.player === battleActivePlayerId.value && creature.hex >= 36).length)

function nextPhase(): void {
  selectionStore.deselectCreature()
  void gameStore.nextBattlePhase()
}
</script>
<style scoped lang="sass">
@import "~/styles/terrain-colors.sass"

@include battlemap-colors(".board :deep(.hex)", fill)

</style>
