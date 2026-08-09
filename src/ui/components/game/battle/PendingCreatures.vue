<template>
  <div class="px-2 pb-1">
    <Creature
      v-for="creature in creatures"
      :key="creature.id"
      :type="creature.type"
      :player="game.getPlayerById(creature.player)"
      :class="{ interactive,
                selected: creature === selectedCreature }"
      class="ma-1 pending"
      @click="interactive && emit('select', creature)"
    />
    <Creature
      v-if="showRemove && selectedCreature"
      :player="game.getPlayerById(gameStore.battleActivePlayer!)"
      none-label="Put Back"
      class="ma-1 interactive"
      @click="removeSelected(selectedCreature)"
    />
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue"
import { BattleCreature } from "@/models/battle"
import { useGameStore } from "~/stores/game"
import Creature from "../Creature.vue"

const props = defineProps<{
  creatures: BattleCreature[]
  interactive: boolean
  selectedCreature: BattleCreature | undefined
}>()

const emit = defineEmits<{
  select: [creature: BattleCreature]
}>()

const gameStore = useGameStore()
const game = gameStore.game

const showRemove = computed(() => props.interactive &&
  (props.selectedCreature?.initialHex ?? -1) >= 36 &&
  (props.selectedCreature?.hex ?? -1) < 36)

function removeSelected(creature: BattleCreature): void {
  void game.doMoveCreature({ creature, hex: creature.initialHex })
}
</script>
<style scoped lang="sass">
.interactive
  cursor: pointer

.selected
  outline: 4px solid rgb(var(--v-theme-secondary))
  outline-offset: -2px
</style>
