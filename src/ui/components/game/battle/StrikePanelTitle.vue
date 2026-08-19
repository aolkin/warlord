<template>
  <v-card-title class="d-flex ga-1">
    <span :class="`text-player-${attacker.player}`">{{ attackerLabel }}</span>
    <span>vs</span>
    <span :class="`text-player-${target.player}`">{{ targetLabel }}</span>
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

function withHazardSuffix(name: string, hazard: Hazard): string {
  return hazard === Hazard.NONE ? name : `${name} (${Hazard[hazard].toLowerCase()})`
}

const attackerLabel = computed(() => withHazardSuffix(props.attacker.name, attackerHazard.value))
const targetLabel = computed(() => withHazardSuffix(props.target.name, targetHazard.value))
</script>
