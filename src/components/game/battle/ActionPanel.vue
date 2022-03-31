<template>
  <v-card v-bind="$props" class="ma-3" width="300">
    <v-card-title>
      Hex: {{ focusedBattleHex }} ({{ Hazard[land.getHazard(focusedBattleHex)] }})
      <span v-if="land.getElevation(focusedBattleHex) > 0">+{{ land.getElevation(focusedBattleHex) }}</span>
    </v-card-title>
    <v-card-header>
      <v-card-header-text>{{ playerById(battleActivePlayer).name }}'s Turn</v-card-header-text>
      <v-card-avatar>
        <v-icon :icon="phaseIcon" size="large" />
      </v-card-avatar>
      <v-card-avatar>
        <v-icon :icon="roundIcon" size="x-large" />
      </v-card-avatar>
    </v-card-header>
    <v-card-text v-if="battlePhaseType === BattlePhaseType.MOVE && pendingCreatures > 0">
      You have {{ pendingCreatures }} creature{{ pendingCreatures > 1 ? 's' : '' }} that
      {{ pendingCreatures > 1 ? 'have' : 'has' }} not entered the battle board. If they do
      not do so this round, they will be eliminated.
    </v-card-text>
    <v-fade-transition leave absolute>
      <v-card-actions>
        <v-btn block variant="outlined" @click="nextPhase">
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
    ...mapGetters("ui/selections", ["focusedBattleHex"]),
    ...mapGetters("game", ["battlePhaseType", "battleActivePlayer", "playerById"]),
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
