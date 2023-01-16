<template>
  <v-card
    width="300"
    :title="`${playerById(battleActivePlayer).name}'s Turn`"
  >
    <template #prepend>
      <v-icon :icon="roundIcon" size="x-large" :title="`Round ${activeBattle.round + 1}`" />
      <v-icon :icon="phaseIcon" size="large" :title="phaseTypeTitle" />
    </template>
    <v-card-subtitle v-if="debugUi">
      Hex: {{ focusedBattleHex }} ({{ Hazard[land.getHazard(focusedBattleHex)] }})
      <span v-if="land.getElevation(focusedBattleHex) > 0">+{{ land.getElevation(focusedBattleHex) }}</span>
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
    <v-fade-transition leave absolute>
      <v-card-actions>
        <v-btn block variant="outlined" :disabled="!mayProceed" @click="nextPhase">
          End {{ phaseTypeTitle }}
        </v-btn>
      </v-card-actions>
    </v-fade-transition>
  </v-card>
</template>
<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapActions, mapGetters, mapMutations, mapState } from "vuex"
import {
  BATTLE_PHASE_TITLES,
  BATTLE_PHASE_TYPES,
  BattleBoard,
  BattleCreature,
  BattlePhaseType,
  Hazard
} from "~/models/battle"

export default defineComponent({
  name: "ActionPanel",
  data: () => ({
    Hazard,
    BattlePhaseType,
    BATTLE_PHASE_TITLES,
    BATTLE_PHASE_TYPES
  }),
  computed: {
    ...mapState("game", ["activeBattle"]),
    ...mapState("ui/preferences", ["debugUi"]),
    ...mapGetters("ui/selections", ["focusedBattleHex"]),
    ...mapGetters("game", ["battlePhaseType", "battleActivePlayer", "playerById",
      "battleCarryoverTargets"]),
    phaseTypeTitle(): string {
      switch (this.battlePhaseType) {
        case BattlePhaseType.MOVE:
          return "Movement"
        case BattlePhaseType.STRIKE:
          return "Strikes"
        case BattlePhaseType.STRIKEBACK:
          return "Strikebacks"
        default:
          return "Unknown"
      }
    },
    phaseIcon(): string {
      switch (this.battlePhaseType) {
        case BattlePhaseType.MOVE:
          return "mdi-cursor-move"
        case BattlePhaseType.STRIKE:
          return "mdi-sword"
        case BattlePhaseType.STRIKEBACK:
          return "mdi-shield-sword"
        default:
          return ""
      }
    },
    pendingStrikes(): BattleCreature[] {
      if (this.battlePhaseType === BattlePhaseType.STRIKE ||
        this.battlePhaseType === BattlePhaseType.STRIKEBACK) {
        return this.activeBattle.getPendingStrikes()
      } else {
        return []
      }
    },
    mayProceed(): boolean {
      return this.pendingStrikes.length === 0 && !this.battleCarryoverTargets
    },
    roundIcon(): string {
      const name = `mdi-numeric-${this.activeBattle.round + 1}-box`
      return name + (this.battleActivePlayer === this.activeBattle.defender ? "-outline" : "")
    },
    land(): BattleBoard {
      return this.activeBattle.getBoard()
    },
    pendingCreatures(): number {
      return this.activeBattle.creatures.filter((creature: BattleCreature) =>
        creature.player === this.battleActivePlayer && creature.hex >= 36).length
    }
  },
  methods: {
    ...mapMutations("ui/selections", ["deselectCreature"]),
    ...mapActions("game", ["nextBattlePhase"]),
    nextPhase(): void {
      this.deselectCreature()
      this.nextBattlePhase()
    }
  }
})
</script>
<style scoped lang="sass">
@import "@/styles/terrain-colors.sass"

@include battlemap-colors(".board :deep(.hex)", fill)

</style>
