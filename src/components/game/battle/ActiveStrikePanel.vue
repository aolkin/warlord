<template>
  <v-fade-transition>
    <v-card v-if="strike" v-bind="$props" class="ma-3" width="300">
      <v-card-title>
        <span :class="`text-player-${attacker.player}`">
          {{ attacker.name() }}
          <span v-if="attackerHazard !== Hazard.NONE">({{ Hazard[attackerHazard].toLowerCase() }})</span>
        </span>
        <span>&nbsp;vs&nbsp;</span>
        <span :class="`text-player-${target.player}`">
          {{ target.name() }}
          <span v-if="targetHazard !== Hazard.NONE">({{ Hazard[targetHazard].toLowerCase() }})</span>
        </span>
      </v-card-title>
      <v-card-header>
        <v-card-header-text v-if="activeStrike">
          <v-icon
            v-for="(roll, index) in activeStrike.rolls"
            :key="index"
            size="x-large"
            :class="{'text-secondary': roll >= activeStrike.toHit, 'no-hit': roll < activeStrike.toHit}"
            :icon="`mdi-dice-${roll}`"
          />
        </v-card-header-text>
      </v-card-header>
      <v-card-header v-if="(activeStrike?.carryoverHits ?? 0) > 0">
        <v-card-header-text>
          The {{ target.name() }} is dead.
          {{ activeStrike.carryoverHits }} hit{{ activeStrike.carryoverHits === 1 ? "" : "s" }} may carry over.
        </v-card-header-text>
      </v-card-header>
      <v-card-text>
        {{ activeStrike ? "Rolled " : "" }}{{ strike.dice }} {{ strike === 1 ? "die" : "dice" }},
        {{ activeStrike ? "needed" : "needing" }} {{ strike.toHit }}s or better to hit.
      </v-card-text>
    </v-card>
  </v-fade-transition>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapGetters, mapState } from "vuex"
import { ActiveStrike, BattleBoard, BattleCreature, Hazard, Strike } from "~/models/battle"

export default defineComponent({
  name: "ActiveStrikePanel",
  data: () => ({
    Hazard
  }),
  computed: {
    ...mapState("game", ["activeBattle"]),
    ...mapGetters("ui/selections", ["selectedCreature", "focusedCreature", "engagements"]),
    board(): BattleBoard {
      return this.activeBattle.getBoard()
    },
    activeStrike(): ActiveStrike | undefined {
      return this.activeBattle.activeStrike
    },
    attacker(): BattleCreature | undefined {
      return this.activeStrike
        ? this.activeBattle.creatureOnHex(this.activeStrike.attacker)
        : this.selectedCreature
    },
    target(): BattleCreature | undefined {
      return this.activeStrike
        ? this.activeBattle.creatureOnHex(this.activeStrike.target)
        : (this.engagements?.includes(this.focusedCreature) ? this.focusedCreature : undefined)
    },
    targetedStrike(): Strike | undefined {
      if (this.attacker && this.target) {
        return this.activeBattle.getAdjustedStrike(this.attacker, this.target)
      }
      return undefined
    },
    strike(): Strike | undefined {
      return this.activeStrike
        ? {
            toHit: this.activeStrike.toHit,
            dice: this.activeStrike.rolls.length
          }
        : this.targetedStrike
    },
    attackerHazard(): Hazard {
      return this.attacker ? this.board.getHazard(this.attacker?.hex) : Hazard.NONE
    },
    targetHazard(): Hazard {
      return this.target ? this.board.getHazard(this.target?.hex) : Hazard.NONE
    }
  }
})
</script>

<style scoped lang="sass">
.no-hit
  opacity: 0.6
</style>
