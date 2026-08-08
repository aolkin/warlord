<template>
  <div class="px-2 pb-1">
    <Creature
      v-for="creature in creatures"
      :key="creature.id"
      :type="creature.type"
      :player="gameStore.playerById(creature.player)"
      :class="{ interactive: gameStore.game.activeBattle!.phase === expectedPhase,
                selected: creature === selectionStore.selectedCreature }"
      class="ma-1 pending"
      @click="gameStore.game.activeBattle!.phase === expectedPhase && selectionStore.selectCreature(creature)"
    />
    <Creature
      v-if="showRemove"
      :player="gameStore.playerById(gameStore.battleActivePlayer!)"
      none-label="Put Back"
      class="ma-1 interactive"
      @click="removeSelected"
    />
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue"
import { BattleCreature, BattlePhase } from "@/models/battle"
import { useGameStore } from "~/stores/game"
import { useSelectionStore } from "~/stores/ui/selection"
import Creature from "../Creature.vue"

const props = defineProps<{
  creatures: BattleCreature[]
  expectedPhase: BattlePhase
}>()

const gameStore = useGameStore()
const selectionStore = useSelectionStore()

const showRemove = computed(() => gameStore.game.activeBattle!.phase === props.expectedPhase &&
  (selectionStore.selectedCreature?.initialHex ?? -1) >= 36 &&
  (selectionStore.selectedCreature?.hex ?? -1) < 36)

function removeSelected(): void {
  const creature = selectionStore.selectedCreature!
  void gameStore.moveCreature({ creature, hex: creature.initialHex })
}
</script>
<style scoped lang="sass">
.interactive
  cursor: pointer

.selected
  outline: 4px solid rgb(var(--v-theme-secondary))
  outline-offset: -2px
</style>
