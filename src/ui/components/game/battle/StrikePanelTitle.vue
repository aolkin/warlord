<template>
  <v-card-title>
    <span :class="`text-player-${attacker.player}`">
      {{ attacker.name() }}
      <span v-if="attackerHazard !== Hazard.NONE">({{ Hazard[attackerHazard].toLowerCase() }}) </span>
    </span>
    <span>vs </span>
    <span :class="`text-player-${target.player}`">
      {{ target.name() }}
      <span v-if="targetHazard !== Hazard.NONE">({{ Hazard[targetHazard].toLowerCase() }})</span>
    </span>
  </v-card-title>
</template>
<script setup lang="ts">
import { computed } from "vue"
import { useStore } from "vuex"
import { BattleBoard, BattleCreature, Hazard } from "@/models/battle"

const props = defineProps<{
  attacker: BattleCreature
  target: BattleCreature
}>()

const store = useStore()

const activeBattle = computed(() => store.state.game.activeBattle)

const board = computed((): BattleBoard => activeBattle.value.getBoard())
const attackerHazard = computed((): Hazard =>
  props.attacker ? board.value.getHazard(props.attacker?.hex) : Hazard.NONE)
const targetHazard = computed((): Hazard =>
  props.target ? board.value.getHazard(props.target?.hex) : Hazard.NONE)
</script>
