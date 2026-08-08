<template>
  <v-expand-transition>
    <v-card
      v-if="strike"
      width="300"
    >
      <StrikePanelTitle
        :attacker="props.selectedCreature!"
        :target="(target ?? rangedTarget)!"
      />
      <v-card-text>
        {{ strike.dice }} {{ strike.dice === 1 ? "die" : "dice" }}, needing {{ strike.toHit }}s or better to hit.
      </v-card-text>
    </v-card>
  </v-expand-transition>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { BattleCreature, RangestrikeTarget, Strike } from "@/models/battle"
import { useGameStore } from "~/stores/game"
import { useSelectionStore } from "~/stores/ui/selection"
import StrikePanelTitle from "./StrikePanelTitle.vue"

const props = defineProps<{
  selectedCreature: BattleCreature | undefined
}>()

const gameStore = useGameStore()
const selectionStore = useSelectionStore()

const activeBattle = computed(() => gameStore.game.activeBattle!)

const target = computed<BattleCreature | undefined>(() =>
  selectionStore.focusedCreature !== undefined && selectionStore.engagements.includes(selectionStore.focusedCreature)
    ? selectionStore.focusedCreature
    : undefined)
const rangedFocus = computed<RangestrikeTarget | undefined>(() =>
  selectionStore.focusedCreature && selectionStore.rangestrikes.filter(
    (rangestrike: RangestrikeTarget) => rangestrike.creature === selectionStore.focusedCreature)[0])
const rangedTarget = computed<BattleCreature | undefined>(() => rangedFocus.value?.creature)
const strike = computed<Strike | undefined>(() => {
  const selectedCreature = props.selectedCreature
  if (selectedCreature) {
    if (target.value) {
      return activeBattle.value.getAdjustedStrike(selectedCreature, target.value)
    } else if (rangedFocus.value) {
      return activeBattle.value.getRangestrike(selectedCreature, rangedFocus.value)
    }
  }
  return undefined
})
</script>

<style scoped lang="sass">
</style>
