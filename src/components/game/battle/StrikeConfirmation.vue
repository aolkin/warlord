<template>
  <v-dialog max-width="540">
    <v-card :title="`Attack ${targetedCreatureName} with ${selectedCreatureName}`">
      <v-card-text>
        Are you sure you want to attack this {{ targetedCreatureName }}
        ({{ targetedCreature?.wounds }} hits taken) with your {{ selectedCreatureName }}?
      </v-card-text>
      <v-card-text>
        You will roll {{ targetedStrike.dice }} {{ targetedStrike.dice > 1 ? "dice" : "die" }}
        and must roll {{ targetedStrike.toHit }}s or better to hit your opponent.
        <span v-if="targetedStrikeWasAdjusted">
          This has been adjusted due to terrain and would otherwise have been
          {{ targetedStrikeUnadjusted.dice }} {{ targetedStrikeUnadjusted.dice > 1 ? "dice" : "die" }}
          needing {{ targetedStrikeUnadjusted.toHit }}s or better.
        </span>
      </v-card-text>
      <v-card-text v-if="tougherCarryovers.length > 0">
        You may choose to roll with a higher "to hit" requirement to enable your attack to carry over to
        these creatures it would otherwise be unable to: {{ tougherCarryovers }}.
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
import { BattleCreature, Strike } from "~/models/battle"

export default defineComponent({
  name: "StrikeConfirmation",
  props: {
    targetedCreature: {
      type: BattleCreature,
      required: false,
      default: undefined
    },
    targetedStrike: {
      type: Object as PropType<Strike>,
      required: false,
      default: () => ({ dice: 0, toHit: 0 })
    },
    targetedStrikeUnadjusted: {
      type: Object as PropType<Strike>,
      required: false,
      default: () => ({ dice: 0, toHit: 0 })
    },
    tougherCarryovers: {
      type: Array as PropType<BattleCreature[]>,
      required: false,
      default: () => []
    }
  },
  emits: ["cancel", "attack"],
  computed: {
    ...mapState("game", ["activeBattle"]),
    ...mapGetters("ui/selections", ["movementHexes", "selectedCreature", "engagements"]),
    selectedCreatureName(): string {
      return this.selectedCreature?.name()
    },
    targetedCreatureName(): string {
      return this.targetedCreature?.name()
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
