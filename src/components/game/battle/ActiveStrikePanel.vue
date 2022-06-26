<template>
  <v-fade-transition>
    <v-card v-if="activeStrike" v-bind="$props" class="ma-3" width="300">
      <v-card-title>
        <span :class="`text-player-${attacker.player}`">{{ attacker.name() }}</span>
        <span>&nbsp;vs&nbsp;</span>
        <span :class="`text-player-${target.player}`">{{ target.name() }}</span>
      </v-card-title>
      <v-card-header>
        <v-card-header-text>
          <v-icon
            v-for="(roll, index) in activeStrike.rolls"
            :key="index"
            size="x-large"
            :class="{'text-secondary': roll >= activeStrike.toHit, 'no-hit': roll < activeStrike.toHit}"
            :icon="`mdi-dice-${roll}`"
          />
        </v-card-header-text>
      </v-card-header>
      <v-card-header v-if="activeStrike.carryoverHits > 0">
        <v-card-header-text>
          The {{ target.name() }} is dead.
          {{ activeStrike.carryoverHits }} hit{{ activeStrike.carryoverHits === 1 ? "" : "s" }} may carry over.
        </v-card-header-text>
      </v-card-header>
      <v-card-text>
        Rolled {{ activeStrike.rolls.length }} {{ activeStrike.rolls.length === 1 ? "die" : "dice" }},
        needed {{ activeStrike.toHit }}s or better to hit.
      </v-card-text>
    </v-card>
  </v-fade-transition>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapState } from "vuex"
import { ActiveStrike, BattleCreature } from "~/models/battle"

export default defineComponent({
  name: "ActiveStrikePanel",
  computed: {
    ...mapState("game", ["activeBattle"]),
    activeStrike(): ActiveStrike {
      return this.activeBattle.activeStrike
    },
    attacker(): BattleCreature {
      return this.activeBattle.creatureOnHex(this.activeStrike.attacker)
    },
    target(): BattleCreature {
      return this.activeBattle.creatureOnHex(this.activeStrike.target)
    }
  }
})
</script>

<style scoped lang="sass">
.no-hit
  opacity: 0.6
</style>
