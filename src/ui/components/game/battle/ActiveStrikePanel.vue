<template>
  <v-expand-transition>
    <v-card
      v-if="strike"
      v-bind="$attrs"
      width="300"
    >
      <StrikePanelTitle
        :attacker="attacker!"
        :target="target!"
      />
      <v-card-text>
        {{ activeStrike ? "Rolled " : "" }}{{ strike.dice }} {{ strike.dice === 1 ? "die" : "dice" }},
        {{ activeStrike ? "needed" : "needing" }} {{ strike.toHit }}s or better to hit.
      </v-card-text>
      <v-card-item
        v-if="activeStrike"
        class="pt-1"
      >
        <v-icon
          v-for="(roll, index) in activeStrike.rolls"
          :key="index"
          size="x-large"
          :class="{'text-secondary': roll >= activeStrike.toHit, 'no-hit': roll < activeStrike.toHit}"
          :icon="`mdi-dice-${roll}`"
        />
      </v-card-item>
      <v-card-item
        v-for="([creature, hits], index) in targets"
        :key="creature.id"
      >
        {{ index === 0 ? "Dealt" : "Carried over" }} {{ hitsString(hits) }} to a
        {{ creature.name() }}{{ activeStrike?.rangestrike ? " with a rangestrike" : "" }}.
        <span v-if="creature.getRemainingHp() < 1">The {{ creature.name() }} is dead.</span>
      </v-card-item>
      <v-card-text v-if="activeStrike">
        <span v-if="activeStrike?.canCarryover && gameStore.battleCarryoverTargets">
          You may still carry over {{ hitsString(activeStrike.getCarryoverHits()) }}.
        </span>
        <span v-else-if="activeStrike?.canCarryover">
          No eligible targets to carry over {{ hitsString(activeStrike.getCarryoverHits(), "excess") }} to.
        </span>
        <span v-else-if="activeStrike?.carryoverSkipped">
          Carrying over excess hits was skipped.
        </span>
        <span v-else-if="!activeStrike?.rangestrike">
          No hits remain to carry over.
        </span>
      </v-card-text>
      <v-card-actions v-if="gameStore.battleCarryoverTargets">
        <v-btn
          block
          variant="outlined"
          @click="gameStore.skipCarryover()"
        >
          Skip Carry Over
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-expand-transition>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { ActiveStrike, Battle, BattleCreature, Strike } from "@/models/battle"
import { useGameStore } from "~/stores/game"
import StrikePanelTitle from "./StrikePanelTitle.vue"

const props = defineProps<{
  battle: Battle
}>()

const gameStore = useGameStore()

const activeStrike = computed((): ActiveStrike | undefined => props.battle.activeStrike)
const attacker = computed((): BattleCreature | undefined =>
  activeStrike.value && props.battle.creatureOnHex(activeStrike.value.attacker))
const target = computed((): BattleCreature | undefined =>
  activeStrike.value && props.battle.creatureOnHex(activeStrike.value.target))
const targets = computed((): [BattleCreature, number][] =>
  (activeStrike.value?.targets ?? []).map((hex, index) =>
    [props.battle.creatureOnHex(hex)!, activeStrike.value?.targetHits[index] ?? 0]))
const strike = computed((): Strike | undefined => activeStrike.value && {
  toHit: activeStrike.value.toHit,
  dice: activeStrike.value.rolls.length
})
function hitsString(hits: number, modifier?: string): string {
  const extra = modifier === undefined ? "" : modifier + " "
  return `${hits} ${extra}hit${hits === 1 ? "" : "s"}`
}
</script>

<style scoped lang="sass">
.no-hit
  opacity: 0.6
</style>
