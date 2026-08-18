<template>
  <v-card-title>
    <span :class="`text-player-${attacker.player}`">
      {{ attacker.name }}
      <span v-if="attackerHazard !== Hazard.NONE">({{ Hazard[attackerHazard].toLowerCase() }})</span>
    </span>
    <span>vs</span>
    <span :class="`text-player-${target.player}`">
      {{ target.name }}
      <span v-if="targetHazard !== Hazard.NONE">({{ Hazard[targetHazard].toLowerCase() }})</span>
    </span>
  </v-card-title>
</template>
<script setup lang="ts">
import { computed } from "vue"
import { BATTLE_BOARDS, BattleBoard, BattleCreature, Hazard } from "@/models/battle"
import { Terrain } from "@/models/masterboard"

const props = defineProps<{
  attacker: BattleCreature
  target: BattleCreature
  terrain: Terrain
}>()

const board = computed((): BattleBoard => BATTLE_BOARDS[props.terrain])
const attackerHazard = computed((): Hazard =>
  props.attacker ? board.value.getHazard(props.attacker.hex) : Hazard.NONE,
)
const targetHazard = computed((): Hazard => (props.target ? board.value.getHazard(props.target.hex) : Hazard.NONE))
</script>
