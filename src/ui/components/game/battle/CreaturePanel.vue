<template>
  <v-card
    width="342"
    :title="minimized ? 'View off-board creatures' : undefined"
  >
    <v-btn
      position="absolute"
      location="top right"
      variant="plain"
      :rounded="0"
      icon="mdi-window-minimize"
      @click="minimized = !minimized"
    />
    <v-expand-transition>
      <div v-if="!minimized">
        <div
          class="d-flex flex-column"
          :class="orderingClasses"
        >
          <div
            v-if="pendingOffense.length > 0 ||
              (activeBattle.phase === BattlePhase.ATTACKER_MOVE &&
                (selectionStore.selectedCreature?.initialHex ?? -1) >= 36)"
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
              (activeBattle.phase === BattlePhase.DEFENDER_MOVE &&
                (selectionStore.selectedCreature?.initialHex ?? -1) >= 36)"
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
      </div>
    </v-expand-transition>
  </v-card>
</template>
<script setup lang="ts">
import { computed, ref } from "vue"
import { BattleCreature, BattlePhase } from "@/models/battle"
import { Player } from "@/models/player"
import { useGameStore } from "~/stores/game"
import { useSelectionStore } from "~/stores/ui/selection"
import Creature from "../Creature.vue"
import PendingCreatures from "./PendingCreatures.vue"

const props = defineProps<{
  localPlayerIsDefender: boolean
}>()

const gameStore = useGameStore()
const selectionStore = useSelectionStore()

const minimized = ref(false)

const activeBattle = computed(() => gameStore.game.activeBattle!)

const orderingClasses = computed(() =>
  ({
    "flex-column-reverse": props.localPlayerIsDefender
  }))
const attacker = computed<Player>(() =>
  gameStore.playerById(activeBattle.value.attacker))
const defender = computed<Player>(() =>
  gameStore.playerById(activeBattle.value.defender))
const pendingOffense = computed<BattleCreature[]>(() =>
  activeBattle.value.getOffense().filter((creature: BattleCreature) => creature.hex >= 36))
const pendingDefense = computed<BattleCreature[]>(() =>
  activeBattle.value.getDefense().filter((creature: BattleCreature) => creature.hex >= 36))
const deadOffense = computed<BattleCreature[]>(() =>
  activeBattle.value.getOffense().filter((creature: BattleCreature) => creature.hex === 0))
const deadDefense = computed<BattleCreature[]>(() =>
  activeBattle.value.getDefense().filter((creature: BattleCreature) => creature.hex === 0))
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
