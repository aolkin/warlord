<template>
  <v-card-title>
    <span :class="`text-player-${attacker.player}`">
      {{ attacker.name() }}
      <span v-if="attackerHazard !== Hazard.NONE">({{ Hazard[attackerHazard].toLowerCase() }}) </span>
    </span>
    <span>vs </span>
    <span :class="`text-player-${target.player}`">
      {{ target.name() }}
      <span v-if="targetHazard !== Hazard.NONE">({{ Hazard[targetHazard].toLowerCase() }})</span>
    </span>
  </v-card-title>
</template>
<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapState } from "vuex"
import { BattleBoard, BattleCreature, Hazard } from "~/models/battle"

export default defineComponent({
  name: "StrikePanelTitle",
  props: {
    attacker: {
      type: BattleCreature,
      required: true
    },
    target: {
      type: BattleCreature,
      required: true
    }
  },
  data: () => ({
    Hazard
  }),
  computed: {
    ...mapState("game", ["activeBattle"]),
    board(): BattleBoard {
      return this.activeBattle.getBoard()
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
