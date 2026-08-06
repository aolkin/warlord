<template>
  <div class="px-2 pb-1">
    <Creature
      v-for="creature in creatures"
      :key="creature.id"
      :type="creature.type"
      :player="playerById(creature.player)"
      :class="{ interactive: activeBattle.phase === expectedPhase,
                selected: creature === selectionStore.selectedCreature }"
      class="ma-1 pending"
      @click="activeBattle.phase === expectedPhase && selectionStore.selectCreature(creature)"
    />
    <Creature
      v-if="showRemove"
      :player="playerById(battleActivePlayer)"
      none-label="Put Back"
      class="ma-1 interactive"
      @click="removeSelected"
    />
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue"
import { useStore } from "vuex"
import { BattleCreature, BattlePhase } from "~/models/battle"
import { useSelectionStore } from "~/stores/ui/selection"
import Creature from "../Creature.vue"

defineOptions({ name: "PendingCreatures" })

const props = defineProps<{
  creatures: BattleCreature[]
  expectedPhase: BattlePhase
}>()

const store = useStore()
const selectionStore = useSelectionStore()

const activeBattle = computed(() => store.state.game.activeBattle)
const playerById = computed(() => store.getters["game/playerById"])
const battleActivePlayer = computed(() => store.getters["game/battleActivePlayer"])
const showRemove = computed(() => activeBattle.value.phase === props.expectedPhase &&
  (selectionStore.selectedCreature?.initialHex ?? -1) >= 36 &&
  (selectionStore.selectedCreature?.hex ?? -1) < 36)

function removeSelected(): void {
  void store.dispatch("game/moveCreature",
    { creature: selectionStore.selectedCreature, hex: selectionStore.selectedCreature!.initialHex })
}
</script>
<style scoped lang="sass">
.interactive
  cursor: pointer

.selected
  outline: 4px solid rgb(var(--v-theme-secondary))
  outline-offset: -2px
</style>
