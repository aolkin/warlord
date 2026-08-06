<template>
  <v-expand-transition>
    <v-card
      v-if="strike"
      v-bind="$props as any"
      width="300"
    >
      <StrikePanelTitle
        :attacker="selectedCreature!"
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
import { useSelectionStore } from "~/stores/selection"
import StrikePanelTitle from "./StrikePanelTitle.vue"

defineOptions({ name: "FocusedStrikePanel" })

const store = useStore()
const selectionStore = useSelectionStore()

const activeBattle = computed(() => store.state.game.activeBattle)
const selectedCreature = computed<BattleCreature | undefined>(() => selectionStore.selectedCreature)
const focusedCreature = computed<BattleCreature | undefined>(() => selectionStore.focusedCreature)
const engagements = computed<BattleCreature[]>(() => selectionStore.engagements)
const rangestrikes = computed<RangestrikeTarget[]>(() => selectionStore.rangestrikes)

const target = computed<BattleCreature | undefined>(() =>
  focusedCreature.value !== undefined && engagements.value.includes(focusedCreature.value)
    ? focusedCreature.value
    : undefined)
const rangedFocus = computed<RangestrikeTarget | undefined>(() =>
  focusedCreature.value && rangestrikes.value.filter(
    (rangestrike: RangestrikeTarget) => rangestrike.creature === focusedCreature.value)[0])
const rangedTarget = computed<BattleCreature | undefined>(() => rangedFocus.value?.creature)
const strike = computed<Strike | undefined>(() => {
  if (selectedCreature.value) {
    if (target.value) {
      return activeBattle.value.getAdjustedStrike(selectedCreature.value, target.value)
    } else if (rangedFocus.value) {
      return activeBattle.value.getRangestrike(selectedCreature.value, rangedFocus.value)
    }
  }
  return undefined
})
</script>

<style scoped lang="sass">
</style>
