<template>
  <v-expand-transition>
    <v-card
      v-if="strike"
      width="300"
    >
      <StrikePanelTitle
        :attacker="props.attacker"
        :target="(target ?? rangedTarget)!"
        :terrain="activeBattle.terrain"
      />
      <v-card-text>
        {{ strike.dice }} {{ strike.dice === 1 ? "die" : "dice" }}, needing {{ strike.toHit }}s or better to hit.
      </v-card-text>
    </v-card>
  </v-expand-transition>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Battle, BattleCreature, RangestrikeTarget, Strike } from "@/models/battle"
import { useGameStore } from "~/stores/game"
import StrikePanelTitle from "./StrikePanelTitle.vue"

const props = defineProps<{
  attacker: BattleCreature
  focusedCreature: BattleCreature
}>()

const game = useGameStore().game

const activeBattle = computed(() => game.activeBattle!)

const engagements = computed<BattleCreature[]>(() => Battle.engagedWith(activeBattle.value, props.attacker))
const rangestrikes = computed<RangestrikeTarget[]>(() => Battle.rangestrikeTargets(activeBattle.value, props.attacker))

const target = computed<BattleCreature | undefined>(() =>
  engagements.value.includes(props.focusedCreature)
    ? props.focusedCreature
    : undefined)
const rangedFocus = computed<RangestrikeTarget | undefined>(() =>
  rangestrikes.value.filter(
    (rangestrike: RangestrikeTarget) => rangestrike.creature === props.focusedCreature)[0])
const rangedTarget = computed<BattleCreature | undefined>(() => rangedFocus.value?.creature)
const strike = computed<Strike | undefined>(() => {
  if (target.value) {
    return Battle.getAdjustedStrike(activeBattle.value, props.attacker, target.value)
  } else if (rangedFocus.value) {
    return Battle.getRangestrike(props.attacker, rangedFocus.value)
  }
  return undefined
})
</script>

<style scoped lang="sass">
</style>
