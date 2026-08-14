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
          @click="Battle.nextPhase(battle)"
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
  BATTLE_PHASE_TYPES,
  Battle,
  BattleCreature,
  BattlePhaseType
} from "@/models/battle"
import { TitanGame } from "@/models/game"
import { PlayerId } from "@/models/player"
import { useGameStore } from "~/stores/game"

const props = defineProps<{
  battle: Battle
}>()

const gameStore = useGameStore()
const game = gameStore.game

const battlePhaseType = computed(() => BATTLE_PHASE_TYPES[props.battle.phase])
const battleActivePlayerId = computed((): PlayerId => props.battle.activePlayer)
const battleActivePlayer = computed(() => TitanGame.getPlayerById(game, battleActivePlayerId.value))

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
    return Battle.getPendingStrikes(props.battle)
  } else {
    return []
  }
})

const mayProceed = computed((): boolean =>
  pendingStrikes.value.length === 0 && !Battle.carryoverTargets(props.battle))

const roundIcon = computed((): string => {
  const name = `mdi-numeric-${props.battle.round + 1}-box`
  return name + (battleActivePlayerId.value === props.battle.defender ? "-outline" : "")
})

const pendingCreatures = computed((): number =>
  props.battle.creatures.filter((creature: BattleCreature) =>
    creature.player === battleActivePlayerId.value && creature.hex >= 36).length)
</script>
<style scoped lang="sass">
@import "~/styles/terrain-colors.sass"

@include battlemap-colors(".board :deep(.hex)", fill)

</style>
