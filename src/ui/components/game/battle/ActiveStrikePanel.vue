<template>
  <v-card
    v-bind="$attrs"
    width="300"
  >
    <StrikePanelTitle
      :attacker="attacker"
      :target="target"
    />
    <v-card-text>
      Rolled {{ activeStrike.rolls.length }} {{ activeStrike.rolls.length === 1 ? "die" : "dice" }},
      needed {{ activeStrike.toHit }}s or better to hit.
    </v-card-text>
    <v-card-item class="pt-1">
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
      {{ creature.name }}{{ activeStrike.rangestrike ? " with a rangestrike" : "" }}.
      <span v-if="creature.wounds >= creature.strength">
        The {{ creature.name }} is dead.
      </span>
    </v-card-item>
    <v-card-text>
      <span v-if="ActiveStrike.getCarryoverHits(activeStrike) > 0 && battle.carryoverTargets()">
        You may still carry over {{ hitsString(ActiveStrike.getCarryoverHits(activeStrike)) }}.
      </span>
      <span v-else-if="ActiveStrike.getCarryoverHits(activeStrike) > 0">
        No eligible targets to carry over
        {{ hitsString(ActiveStrike.getCarryoverHits(activeStrike), "excess") }} to.
      </span>
      <span v-else-if="activeStrike.carryoverSkipped">
        Carrying over excess hits was skipped.
      </span>
      <span v-else-if="!activeStrike.rangestrike">
        No hits remain to carry over.
      </span>
    </v-card-text>
    <v-card-actions v-if="battle.carryoverTargets()">
      <v-btn
        block
        variant="outlined"
        @click="battle.skipCarryover()"
      >
        Skip Carry Over
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { ActiveStrike, Battle, BattleCreature } from "@/models/battle"
import StrikePanelTitle from "./StrikePanelTitle.vue"

const props = defineProps<{
  battle: Battle
  activeStrike: ActiveStrike
}>()

const attacker = computed((): BattleCreature => props.battle.creatureOnHex(props.activeStrike.attacker)!)
const target = computed((): BattleCreature => props.battle.creatureOnHex(props.activeStrike.targets[0])!)
const targets = computed((): [BattleCreature, number][] =>
  props.activeStrike.targets.map((hex, index) =>
    [props.battle.creatureOnHex(hex)!, props.activeStrike.targetHits[index] ?? 0]))
function hitsString(hits: number, modifier?: string): string {
  const extra = modifier === undefined ? "" : modifier + " "
  return `${hits} ${extra}hit${hits === 1 ? "" : "s"}`
}
</script>

<style scoped lang="sass">
.no-hit
  opacity: 0.6
</style>
