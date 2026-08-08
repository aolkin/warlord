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
        <v-btn
          variant="text"
          color="secondary"
          @click="$emit('cancel')"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          class="float-right"
          @click="$emit('attack')"
        >
          Attack
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { computed } from "vue"
import { isEqual, range } from "lodash-es"
import { Battle, BattleCreature, isRangestrike, Strike } from "@/models/battle"
import { useSelectionStore } from "~/stores/ui/selection"

const props = defineProps<{
  battle: Battle
  attacker: BattleCreature
  targetedCreature: BattleCreature
  optionalToHit?: number
}>()

const emit = defineEmits<{
  cancel: []
  attack: []
  "update:optionalToHit": [value: number | undefined]
}>()

const selectionStore = useSelectionStore()

const selectedCreatureName = computed(() => props.attacker.name())
const targetedCreatureName = computed(() => props.targetedCreature?.name() ?? "")
const targetedStrike = computed<Strike>(() =>
  props.battle.getTargetedStrike(props.attacker, props.targetedCreature))
const targetedStrikeUnadjusted = computed<Strike>(() =>
  props.battle.getRawStrike(props.attacker,
    isRangestrike(props.targetedCreature) ? props.targetedCreature.creature : props.targetedCreature))
const targetedStrikeWasAdjusted = computed(() =>
  !isEqual(targetedStrikeUnadjusted.value, targetedStrike.value))
const carryoversImpossible = computed(() => selectionStore.engagements.length < 2 ||
  targetedStrike.value.dice - props.targetedCreature.getRemainingHp() <= 0)
const normalCarryovers = computed<BattleCreature[]>(() => carryoversImpossible.value
  ? []
  : selectionStore.engagements
    .filter((target: BattleCreature) =>
      props.battle.toHitAdjusted(props.attacker, target) <= targetedStrike.value.toHit)
    .filter((target: BattleCreature) => props.targetedCreature !== target))
const tougherCarryovers = computed<BattleCreature[]>(() => carryoversImpossible.value
  ? []
  : selectionStore.engagements
    .filter((target: BattleCreature) =>
      props.battle.toHitAdjusted(props.attacker, target) > targetedStrike.value.toHit))
const toHitAdjustments = computed<Record<number, BattleCreature[]>>(() =>
  tougherCarryovers.value.reduce((adjustments: Record<number, BattleCreature[]>, creature) => {
    const toHit = props.battle.toHitAdjusted(props.attacker, creature)
    range(toHit, 7).forEach(numToUpdate =>
      adjustments[numToUpdate] = [...(adjustments[numToUpdate] ?? []), creature])
    return adjustments
  }, {}))

const selectedOptionalToHit = computed<number[]>({
  get() {
    return [props.optionalToHit ?? targetedStrike.value.toHit]
  },
  set(values: number[]) {
    const value = values[0]
    emit("update:optionalToHit", value === targetedStrike.value.toHit ? undefined : value)
  }
})
</script>
<style scoped lang="sass">
@import "~/styles/terrain-colors.sass"

@include battlemap-colors(".board :deep(.hex)", fill)

.v-btn-group.card-action-toggle .v-btn:not(:first-child)
  margin-inline-start: initial

.to-hit--selected
  color: rgb(var(--v-theme-secondary))

</style>
