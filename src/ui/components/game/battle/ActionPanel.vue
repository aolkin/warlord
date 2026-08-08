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
  mdiCursorMove,
  mdiNumeric0Box,
  mdiNumeric0BoxOutline,
  mdiNumeric1Box,
  mdiNumeric1BoxOutline,
  mdiNumeric2Box,
  mdiNumeric2BoxOutline,
  mdiNumeric3Box,
  mdiNumeric3BoxOutline,
  mdiNumeric4Box,
  mdiNumeric4BoxOutline,
  mdiNumeric5Box,
  mdiNumeric5BoxOutline,
  mdiNumeric6Box,
  mdiNumeric6BoxOutline,
  mdiNumeric7Box,
  mdiNumeric7BoxOutline,
  mdiNumeric8Box,
  mdiNumeric8BoxOutline,
  mdiNumeric9Box,
  mdiNumeric9BoxOutline,
  mdiNumeric9PlusBox,
  mdiNumeric9PlusBoxOutline,
  mdiShieldSword,
  mdiSword
} from "@mdi/js"
import {
  BattleBoard,
  BattleCreature,
  BattlePhaseType,
  Hazard
} from "@/models/battle"
import { indexedIcon } from "~/icons"
import { useTypedStore } from "~/plugins/vuex"
import { usePreferencesStore } from "~/stores/ui/preferences"
import { useSelectionStore } from "~/stores/ui/selection"

// Indexed by round number (0-9); rounds beyond that fall back to the "9+" icon.
const NUMERIC_BOX_ICONS = [
  mdiNumeric0Box, mdiNumeric1Box, mdiNumeric2Box, mdiNumeric3Box, mdiNumeric4Box,
  mdiNumeric5Box, mdiNumeric6Box, mdiNumeric7Box, mdiNumeric8Box, mdiNumeric9Box
]
const NUMERIC_BOX_OUTLINE_ICONS = [
  mdiNumeric0BoxOutline, mdiNumeric1BoxOutline, mdiNumeric2BoxOutline, mdiNumeric3BoxOutline,
  mdiNumeric4BoxOutline, mdiNumeric5BoxOutline, mdiNumeric6BoxOutline, mdiNumeric7BoxOutline,
  mdiNumeric8BoxOutline, mdiNumeric9BoxOutline
]

const store = useTypedStore()
const selectionStore = useSelectionStore()
const preferencesStore = usePreferencesStore()

// ActionPanel only renders inside BattleBoard's v-else branch (active battle present).
const activeBattle = computed(() => store.state.game.activeBattle!)
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
      return mdiCursorMove
    case BattlePhaseType.STRIKE:
      return mdiSword
    case BattlePhaseType.STRIKEBACK:
      return mdiShieldSword
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
  const round = activeBattle.value.round + 1
  const outline = battleActivePlayer.value === activeBattle.value.defender
  const icons = outline ? NUMERIC_BOX_OUTLINE_ICONS : NUMERIC_BOX_ICONS
  return indexedIcon(icons, round, outline ? mdiNumeric9PlusBoxOutline : mdiNumeric9PlusBox)
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
@import "~/styles/terrain-colors.sass"

@include battlemap-colors(".board :deep(.hex)", fill)

</style>
