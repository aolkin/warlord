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
import { isEqual } from "lodash-es"
import { BattleCreature, RangestrikeTarget, Strike } from "@/models/battle"
import { useGameStore } from "~/stores/game"
import { useSelectionStore } from "~/stores/ui/selection"
import { div } from "~/utils/math"

const props = defineProps<{
  target: RangestrikeTarget
}>()

defineEmits<{
  cancel: []
  attack: []
}>()

const gameStore = useGameStore()
const selectionStore = useSelectionStore()

const activeBattle = computed(() => gameStore.game.activeBattle!)

const selectedCreatureName = computed(() => selectionStore.selectedCreature?.name() ?? "")
const targetedCreature = computed<BattleCreature>(() => props.target.creature)
const targetedCreatureName = computed(() => targetedCreature.value?.name() ?? "")
const targetedStrike = computed<Strike>(() =>
  activeBattle.value.getTargetedStrike(selectionStore.selectedCreature!, props.target))
const targetedStrikeUnadjusted = computed<Strike>(() => {
  const rawStrike = activeBattle.value.getRawStrike(selectionStore.selectedCreature!, targetedCreature.value)
  return {
    toHit: props.target.longDistance ? rawStrike.toHit + 1 : rawStrike.toHit,
    dice: div(rawStrike.dice, 2)
  }
})
const targetedStrikeWasAdjusted = computed(() => !isEqual(targetedStrikeUnadjusted.value, targetedStrike.value))
</script>
<style scoped lang="sass">
@import "~/styles/terrain-colors.sass"

@include battlemap-colors(".board :deep(.hex)", fill)

</style>
