<template>
  <v-card-title>
    <span :class="`text-player-${attacker.player}`">
      {{ creatureName(attacker) }}
      <span v-if="attackerHazard !== Hazard.NONE">({{ Hazard[attackerHazard].toLowerCase() }}) </span>
    </span>
    <span>vs </span>
    <span :class="`text-player-${target.player}`">
      {{ creatureName(target) }}
      <span v-if="targetHazard !== Hazard.NONE">({{ Hazard[targetHazard].toLowerCase() }})</span>
    </span>
  </v-card-title>
</template>
<script lang="ts">
import { defineComponent, PropType } from "vue"
import { mapState } from "vuex"
import { BattleBoard, BattleCreature, creatureName, Hazard } from "~/models/battle"

export default defineComponent({
  name: "StrikePanelTitle",
  props: {
    attacker: {
      type: Object as PropType<BattleCreature>,
      required: true
    },
    target: {
      type: Object as PropType<BattleCreature>,
      required: true
    }
  },
  data: () => ({
    Hazard,
    creatureName
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
