<template>
  <v-dialog max-width="600">
    <v-card :title="`Rangestrike ${targetedCreatureName} with ${selectedCreatureName}`">
      <v-card-text>
        Are you sure you want to rangestrike this {{ targetedCreatureName }}
        ({{ targetedCreature.wounds }} hit{{ targetedCreature.wounds === 1 ? "" : "s" }} taken)
        with your {{ selectedCreatureName }}?
      </v-card-text>
      <v-card-text>
        You will roll {{ targetedStrike.dice }} {{ targetedStrike.dice > 1 ? "dice" : "die" }}
        and must roll {{ targetedStrike.toHit }}s or better to hit your opponent.
        <span v-if="targetedStrikeWasAdjusted">
          This has been adjusted due to terrain and would otherwise have been
          {{ targetedStrikeUnadjusted.dice }} {{ targetedStrikeUnadjusted.dice > 1 ? "dice" : "die" }}
          needing {{ targetedStrikeUnadjusted.toHit }}s or better.
        </span>
        <span v-if="target.longDistance">
          The strike number needed to hit has been increased by one due to the long distance of this
          rangestrike.
        </span>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" color="secondary" @click="$emit('cancel')">Cancel</v-btn>
        <v-btn color="primary" class="float-right" @click="$emit('attack')">Attack</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script lang="ts">
import { defineComponent, PropType } from "@vue/runtime-core"
import _ from "lodash"
import { mapGetters, mapState } from "vuex"
import { BattleCreature, RangestrikeTarget, Strike } from "~/models/battle"
import { div } from "~/utils/math"

export default defineComponent({
  name: "RangestrikeConfirmation",
  props: {
    target: {
      type: Object as PropType<RangestrikeTarget>,
      required: true
    }
  },
  emits: ["cancel", "attack"],
  computed: {
    ...mapState("game", ["activeBattle"]),
    ...mapGetters("ui/selections", ["selectedCreature"]),
    selectedCreatureName(): string {
      return this.selectedCreature?.name()
    },
    targetedCreature(): BattleCreature {
      return this.target.creature
    },
    targetedCreatureName(): string {
      return this.targetedCreature?.name() ?? ""
    },
    targetedStrike(): Strike {
      return this.activeBattle.getTargetedStrike(this.selectedCreature, this.target)
    },
    targetedStrikeUnadjusted(): Strike {
      const rawStrike = this.activeBattle.getRawStrike(this.selectedCreature, this.targetedCreature)
      return {
        toHit: this.target.longDistance ? rawStrike.toHit + 1 : rawStrike.toHit,
        dice: div(rawStrike.dice, 2)
      }
    },
    targetedStrikeWasAdjusted(): boolean {
      return !_.isEqual(this.targetedStrikeUnadjusted, this.targetedStrike)
    }
  }
})
</script>
<style scoped lang="sass">
@import "@/styles/terrain-colors.sass"

@include battlemap-colors(".board :deep(.hex)", fill)

</style>
