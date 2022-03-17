<template>
  <div class="px-2 pb-1">
    <Creature
      v-for="creature in creatures"
      :key="creature.guid"
      :type="creature.type"
      :player="playerById(creature.player)"
      :class="{ interactive: activeBattle.phase === expectedPhase,
                selected: creature === selectedCreature }"
      class="ma-1 pending"
      @click="activeBattle.phase === expectedPhase && selectCreature(creature)"
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
<script lang="ts">
import { defineComponent, PropType } from "@vue/runtime-core"
import { mapActions, mapGetters, mapMutations, mapState } from "vuex"
import { BattlePhase } from "~/models/battle"
import Creature from "../Creature.vue"

export default defineComponent({
  name: "PendingCreatures",
  components: { Creature },
  props: {
    creatures: {
      type: Array,
      required: true
    },
    expectedPhase: {
      type: Number as PropType<BattlePhase>,
      required: true
    }
  },
  data: () => ({
    BattlePhase
  }),
  computed: {
    ...mapState("ui", ["localPlayer"]),
    ...mapState("game", ["activeBattle", "players"]),
    ...mapGetters("ui/selections", ["selectedCreature"]),
    ...mapGetters("game", ["playerById", "battleActivePlayer"]),
    showRemove(): boolean {
      return this.activeBattle.phase === this.expectedPhase &&
        this.selectedCreature?.initialHex >= 36 &&
        this.selectedCreature.hex < 36
    }
  },
  methods: {
    ...mapMutations("ui/selections", ["selectCreature"]),
    ...mapActions("game", ["moveCreature"]),
    removeSelected(): void {
      this.moveCreature({ creature: this.selectedCreature, hex: this.selectedCreature.initialHex })
    }
  }
})
</script>
<style scoped lang="sass">
.interactive
  cursor: pointer

.selected
  outline: 4px solid rgb(var(--v-theme-secondary))
  outline-offset: -2px
</style>
