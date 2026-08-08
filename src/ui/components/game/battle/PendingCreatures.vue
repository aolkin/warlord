<template>
  <div class="px-2 pb-1">
    <Creature
      v-for="creature in creatures"
      :key="creature.id"
      :type="creature.type"
      :player="gameStore.playerById(creature.player)"
      :class="{ interactive: activeBattle.phase === expectedPhase,
                selected: creature === selectedCreature }"
      class="ma-1 pending"
      @click="activeBattle.phase === expectedPhase && emit('select', creature)"
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
import Creature from "../Creature.vue"

const props = defineProps<{
  creatures: BattleCreature[]
  expectedPhase: BattlePhase
  selectedCreature: BattleCreature | undefined
}>()

const emit = defineEmits<{
  select: [creature: BattleCreature]
}>()

const gameStore = useGameStore()

const activeBattle = computed(() => gameStore.game.activeBattle!)

const showRemove = computed(() => activeBattle.value.phase === props.expectedPhase &&
  (props.selectedCreature?.initialHex ?? -1) >= 36 &&
  (props.selectedCreature?.hex ?? -1) < 36)

function removeSelected(): void {
  const creature = props.selectedCreature!
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
