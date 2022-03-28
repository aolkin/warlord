<template>
  <v-card v-bind="$props" class="ma-3" width="342">
    <div class="d-flex flex-column" :class="orderingClasses">
      <div
        v-if="pendingOffense.length > 0 ||
          (activeBattle.phase === BattlePhase.ATTACKER_MOVE && selectedCreature?.initialHex >= 36)"
      >
        <v-card-title>{{ attacker.name }}'s Pending Creatures</v-card-title>
        <PendingCreatures
          :creatures="pendingOffense"
          :expected-phase="BattlePhase.ATTACKER_MOVE"
          class="px-2 pb-1"
        />
      </div>
      <div
        v-if="pendingDefense.length > 0 ||
          (activeBattle.phase === BattlePhase.DEFENDER_MOVE && selectedCreature?.initialHex >= 36)"
      >
        <v-card-title>{{ defender.name }}'s Pending Creatures</v-card-title>
        <PendingCreatures
          :creatures="pendingDefense"
          :expected-phase="BattlePhase.DEFENDER_MOVE"
          class="px-2 pb-1"
        />
      </div>
    </div>
    <div>
      <div v-if="deadOffense.length > 0">
        <v-card-title>{{ attacker.name }}'s Dead Creatures</v-card-title>
        <div class="px-2 pb-1">
          <Creature
            v-for="(creature, index) in deadOffense"
            :key="index"
            :type="creature.type"
            :player="attacker"
            class="ma-1 dead"
          />
        </div>
      </div>
      <div v-if="deadDefense.length > 0">
        <v-card-title>{{ defender.name }}'s Dead Creatures</v-card-title>
        <div class="px-2 pb-1">
          <Creature
            v-for="(creature, index) in deadDefense"
            :key="index"
            :type="creature.type"
            :player="defender"
            class="ma-1 dead"
          />
        </div>
      </div>
    </div>
  </v-card>
</template>
<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapGetters, mapMutations, mapState } from "vuex"
import { BattleCreature, BattlePhase } from "~/models/battle"
import { Player } from "~/models/player"
import Creature from "../Creature.vue"
import PendingCreatures from "./PendingCreatures.vue"

export default defineComponent({
  name: "CreaturePanel",
  components: { PendingCreatures, Creature },
  data() {
    return {
      BattlePhase
    }
  },
  computed: {
    ...mapState("ui", ["localPlayer"]),
    ...mapState("game", ["activeBattle", "players"]),
    ...mapGetters("ui/selections", ["selectedCreature"]),
    ...mapGetters("game", ["playerById"]),
    orderingClasses(): object {
      return { "flex-column-reverse": this.activeBattle.defender === this.players[this.localPlayer].id }
    },
    attacker(): Player {
      return this.playerById(this.activeBattle.attacker)
    },
    defender(): Player {
      return this.playerById(this.activeBattle.defender)
    },
    pendingOffense(): BattleCreature[] {
      return this.activeBattle.getOffense().filter((creature: BattleCreature) => creature.hex >= 36)
    },
    pendingDefense(): BattleCreature[] {
      return this.activeBattle.getDefense().filter((creature: BattleCreature) => creature.hex >= 36)
    },
    deadOffense(): BattleCreature[] {
      return this.activeBattle.getOffense().filter((creature: BattleCreature) => creature.hex === 0)
    },
    deadDefense(): BattleCreature[] {
      return this.activeBattle.getDefense().filter((creature: BattleCreature) => creature.hex === 0)
    }
  },
  methods: {
    ...mapMutations("ui/selections", ["selectCreature"])
  }
})
</script>
<style scoped lang="sass">
.interactive
  cursor: pointer

.selected
  outline: 4px solid rgb(var(--v-theme-secondary))
  outline-offset: -2px

.dead
  filter: brightness(0.5)
</style>
