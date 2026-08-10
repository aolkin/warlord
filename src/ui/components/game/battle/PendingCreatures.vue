<template>
  <div class="px-2 pb-1">
    <Creature
      v-for="creature in creatures"
      :key="creature.id"
      :type="creature.type"
      :player-id="creature.player"
      :class="{ interactive,
                selected: creature.id === selectedCreatureId }"
      class="ma-1 pending"
      @click="interactive && emit('select', creature)"
    />
    <Creature
      v-if="interactive && canLeaveBoard"
      type="Put Back"
      class="ma-1 interactive"
      @click="emit('remove')"
    />
  </div>
</template>
<script setup lang="ts">
import { BattleCreature } from "@/models/battle"
import Creature from "../Creature.vue"

defineProps<{
  creatures: BattleCreature[]
  interactive: boolean
  selectedCreatureId: number | undefined
  canLeaveBoard: boolean
}>()

const emit = defineEmits<{
  select: [creature: BattleCreature]
  remove: []
}>()
</script>
<style scoped lang="sass">
.interactive
  cursor: pointer

.selected
  outline: 4px solid rgb(var(--v-theme-secondary))
  outline-offset: -2px
</style>
