<template>
  <v-dialog max-width="600">
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
        If you kill the {{ targetedCreatureName }}, you may carry over the excess hits to other creatures
        you are engaged with that have the same "to hit" requirement. You may also select a higher
        "to hit" requirement for the entire roll to potentially carry over to other creatures,
        as follows:
        <v-list
          v-model:selected="selectedOptionalToHit"
          active-color="primary"
          mandatory
          select-strategy="single-leaf"
        >
          <v-list-item
            :prepend-icon="`mdi-dice-${targetedStrike.toHit}`"
            :value="targetedStrike.toHit"
          >
            {{ normalCarryovers.map(creature => creature.name()).join(", ") }}
          </v-list-item>
          <v-list-item
            v-for="(creatures, toHit) in toHitAdjustments"
            :key="toHit"
            :prepend-icon="`mdi-dice-${toHit}`"
            :value="Number(toHit)"
          >
            {{ [...normalCarryovers, ...creatures].map(creature => creature.name()).join(", ") }}
          </v-list-item>
        </v-list>
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
import { BattleCreature, isRangestrike, Strike } from "~/models/battle"

export default defineComponent({
  name: "StrikeConfirmation",
  props: {
    targetedCreature: {
      type: Object as PropType<BattleCreature>,
      required: true
    },
    optionalToHit: {
      type: Number,
      required: false,
      default: undefined
    }
  },
  emits: ["cancel", "attack", "update:optionalToHit"],
  computed: {
    ...mapState("game", ["activeBattle"]),
    ...mapGetters("ui/selections", ["movementHexes", "selectedCreature", "engagements"]),
    selectedCreatureName(): string {
      return this.selectedCreature?.name()
    },
    targetedCreatureName(): string {
      return this.targetedCreature?.name() ?? ""
    },
    targetedStrike(): Strike {
      return this.activeBattle.getTargetedStrike(this.selectedCreature, this.targetedCreature)
    },
    targetedStrikeUnadjusted(): Strike {
      return this.activeBattle.getRawStrike(this.selectedCreature,
        isRangestrike(this.targetedCreature) ? this.targetedCreature.creature : this.targetedCreature)
    },
    targetedStrikeWasAdjusted(): boolean {
      return !_.isEqual(this.targetedStrikeUnadjusted, this.targetedStrike)
    },
    toHitAdjustments(): Record<number, BattleCreature[]> {
      return this.tougherCarryovers.reduce((adjustments: Record<number, BattleCreature[]>, creature) => {
        const toHit = this.activeBattle.toHitAdjusted(this.selectedCreature, creature)
        _.range(toHit, 7).forEach(numToUpdate =>
          adjustments[numToUpdate] = [...(adjustments[numToUpdate] ?? []), creature])
        return adjustments
      }, {})
    },
    selectedOptionalToHit: {
      get() {
        return [this.optionalToHit ?? this.targetedStrike.toHit]
      },
      set(values: number[]) {
        const value = values[0]
        this.$emit("update:optionalToHit", value === this.targetedStrike.toHit ? undefined : value)
      }
    },
    carryoversImpossible(): boolean {
      return this.engagements.length < 2 ||
        this.targetedStrike.dice - this.targetedCreature.getRemainingHp() <= 0
    },
    normalCarryovers(): BattleCreature[] {
      return this.carryoversImpossible ? [] : this.engagements
        .filter((target: BattleCreature) =>
          this.activeBattle.toHitAdjusted(this.selectedCreature, target) <= this.targetedStrike.toHit)
        .filter((target: BattleCreature) => this.targetedCreature !== target)
    },
    tougherCarryovers(): BattleCreature[] {
      return this.carryoversImpossible ? [] : this.engagements.filter((target: BattleCreature) =>
        this.activeBattle.toHitAdjusted(this.selectedCreature, target) > this.targetedStrike.toHit)
    }
  }
})
</script>
<style scoped lang="sass">
@import "@/styles/terrain-colors.sass"

@include battlemap-colors(".board :deep(.hex)", fill)

.v-btn-group.card-action-toggle .v-btn:not(:first-child)
  margin-inline-start: initial

.to-hit--selected
  color: rgb(var(--v-theme-secondary))

</style>
