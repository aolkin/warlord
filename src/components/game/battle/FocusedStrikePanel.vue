<template>
  <v-expand-transition>
    <v-card v-if="strike" v-bind="$props" width="300">
      <StrikePanelTitle :attacker="selectedCreature" :target="target ?? rangedTarget" />
      <v-card-text>
        {{ strike.dice }} {{ strike === 1 ? "die" : "dice" }}, needing {{ strike.toHit }}s or better to hit.
      </v-card-text>
    </v-card>
  </v-expand-transition>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapGetters, mapState } from "vuex"
import { BattleCreature, Hazard, RangestrikeTarget, Strike } from "~/models/battle"
import StrikePanelTitle from "./StrikePanelTitle.vue"

export default defineComponent({
  name: "FocusedStrikePanel",
  components: { StrikePanelTitle },
  data: () => ({
    Hazard
  }),
  computed: {
    ...mapState("game", ["activeBattle"]),
    ...mapGetters("ui/selections", ["selectedCreature", "focusedCreature", "engagements", "rangestrikes"]),
    target(): BattleCreature | undefined {
      return this.engagements?.includes(this.focusedCreature) ? this.focusedCreature : undefined
    },
    rangedFocus(): RangestrikeTarget | undefined {
      return this.focusedCreature && this.rangestrikes?.filter(
        (rangestrike: RangestrikeTarget) => rangestrike.creature === this.focusedCreature)[0]
    },
    rangedTarget(): BattleCreature | undefined {
      return this.rangedFocus?.creature
    },
    strike(): Strike | undefined {
      if (this.selectedCreature) {
        if (this.target) {
          return this.activeBattle.getAdjustedStrike(this.selectedCreature, this.target)
        } else if (this.rangedFocus) {
          return this.activeBattle.getRangestrike(this.selectedCreature, this.rangedFocus)
        }
      }
      return undefined
    }
  }
})
</script>

<style scoped lang="sass">
</style>
