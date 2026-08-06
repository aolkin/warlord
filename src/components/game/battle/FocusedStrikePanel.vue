<template>
  <v-expand-transition>
    <v-card
      v-if="strike"
      v-bind="$props as any"
      width="300"
    >
      <StrikePanelTitle
        :attacker="selectionStore.selectedCreature!"
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
import { useStore } from "vuex"
import { BattleCreature, RangestrikeTarget, Strike } from "~/models/battle"
import { useSelectionStore } from "~/stores/ui/selection"
import StrikePanelTitle from "./StrikePanelTitle.vue"

const store = useStore()
const selectionStore = useSelectionStore()

const activeBattle = computed(() => store.state.game.activeBattle)

const target = computed<BattleCreature | undefined>(() =>
  selectionStore.focusedCreature !== undefined && selectionStore.engagements.includes(selectionStore.focusedCreature)
    ? selectionStore.focusedCreature
    : undefined)
const rangedFocus = computed<RangestrikeTarget | undefined>(() =>
  selectionStore.focusedCreature && selectionStore.rangestrikes.filter(
    (rangestrike: RangestrikeTarget) => rangestrike.creature === selectionStore.focusedCreature)[0])
const rangedTarget = computed<BattleCreature | undefined>(() => rangedFocus.value?.creature)
const strike = computed<Strike | undefined>(() => {
  if (selectionStore.selectedCreature) {
    if (target.value) {
      return activeBattle.value.getAdjustedStrike(selectionStore.selectedCreature, target.value)
    } else if (rangedFocus.value) {
      return activeBattle.value.getRangestrike(selectionStore.selectedCreature, rangedFocus.value)
    }
  }
  return undefined
})
</script>

<style scoped lang="sass">
</style>
