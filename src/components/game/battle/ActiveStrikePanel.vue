<template>
  <v-expand-transition>
    <v-card v-if="strike" v-bind="$props" width="300">
      <StrikePanelTitle :attacker="attacker" :target="target" />
      <v-card-text>
        {{ activeStrike ? "Rolled " : "" }}{{ strike.dice }} {{ strike === 1 ? "die" : "dice" }},
        {{ activeStrike ? "needed" : "needing" }} {{ strike.toHit }}s or better to hit.
      </v-card-text>
      <v-card-item v-if="activeStrike" class="pt-1">
        <v-icon
          v-for="(roll, index) in activeStrike.rolls"
          :key="index"
          size="x-large"
          :class="{'text-secondary': roll >= activeStrike.toHit, 'no-hit': roll < activeStrike.toHit}"
          :icon="`mdi-dice-${roll}`"
        />
      </v-card-item>
      <v-card-item v-for="([creature, hits], index) in targets" :key="creature.guid">
        {{ index === 0 ? "Dealt" : "Carried over" }} {{ hitsString(hits) }} to a
        {{ creature.name() }}{{ activeStrike.rangestrike ? " with a rangestrike" : "" }}.
        <span v-if="creature.getRemainingHp() < 1">The {{ creature.name() }} is dead.</span>
      </v-card-item>
      <v-card-text v-if="activeStrike">
        <span v-if="activeStrike?.canCarryover && battleCarryoverTargets">
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
      <v-card-actions v-if="battleCarryoverTargets">
        <v-btn block variant="outlined" @click="skipCarryover">Skip Carry Over</v-btn>
      </v-card-actions>
    </v-card>
  </v-expand-transition>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapActions, mapGetters, mapState } from "vuex"
import { ActiveStrike, BattleCreature, Hazard, Strike } from "~/models/battle"
import StrikePanelTitle from "./StrikePanelTitle.vue"

export default defineComponent({
  name: "ActiveStrikePanel",
  components: { StrikePanelTitle },
  data: () => ({
    Hazard
  }),
  computed: {
    ...mapState("game", ["activeBattle"]),
    ...mapGetters("game", ["battleCarryoverTargets"]),
    ...mapGetters("ui/selections", ["selectedCreature", "focusedCreature", "engagements"]),
    activeStrike(): ActiveStrike | undefined {
      return this.activeBattle.activeStrike
    },
    attacker(): BattleCreature | undefined {
      return this.activeStrike && this.activeBattle.creatureOnHex(this.activeStrike.attacker)
    },
    target(): BattleCreature | undefined {
      return this.activeStrike && this.activeBattle.creatureOnHex(this.activeStrike.target)
    },
    targets(): [BattleCreature, number][] {
      return (this.activeStrike?.targets ?? []).map((hex, index) =>
        [this.activeBattle.creatureOnHex(hex), this.activeStrike?.targetHits[index] ?? 0])
    },
    targetedStrike(): Strike | undefined {
      if (this.attacker && this.target) {
        return this.activeBattle.getAdjustedStrike(this.attacker, this.target)
      }
      return undefined
    },
    strike(): Strike | undefined {
      return this.activeStrike && {
        toHit: this.activeStrike.toHit,
        dice: this.activeStrike.rolls.length
      }
    },
    hitsString(): (hits: number, modifier?: string) => string {
      return (hits: number, modifier?: string) => {
        const extra = modifier === undefined ? "" : modifier + " "
        return `${hits} ${extra}hit${hits === 1 ? "" : "s"}`
      }
    }
  },
  methods: {
    ...mapActions("game", ["skipCarryover"])
  }
})
</script>

<style scoped lang="sass">
.no-hit
  opacity: 0.6
</style>
