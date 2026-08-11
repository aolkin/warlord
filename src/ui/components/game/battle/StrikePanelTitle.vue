<template>
  <v-card-title>
    <span :class="`text-player-${attacker.player}`">
      {{ BattleCreature.name(attacker) }}
      <span v-if="attackerHazard !== Hazard.NONE">({{ Hazard[attackerHazard].toLowerCase() }}) </span>
    </span>
    <span>vs </span>
    <span :class="`text-player-${target.player}`">
      {{ BattleCreature.name(target) }}
      <span v-if="targetHazard !== Hazard.NONE">({{ Hazard[targetHazard].toLowerCase() }})</span>
    </span>
  </v-card-title>
</template>
<script setup lang="ts">
import { computed } from "vue"
import { BattleBoard, BattleCreature, Hazard } from "@/models/battle"
import { useGameStore } from "~/stores/game"

const props = defineProps<{
  attacker: BattleCreature
  target: BattleCreature
}>()

const gameStore = useGameStore()

const board = computed((): BattleBoard => gameStore.game.activeBattle!.getBoard())
const attackerHazard = computed((): Hazard =>
  props.attacker ? board.value.getHazard(props.attacker.hex) : Hazard.NONE)
const targetHazard = computed((): Hazard =>
  props.target ? board.value.getHazard(props.target.hex) : Hazard.NONE)
</script>
