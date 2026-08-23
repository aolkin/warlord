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
          <div v-if="pendingOffense.length > 0 || (attackerMoveActive && props.selectedCanLeaveBoard)">
            <v-card-title>{{ attacker.name }}'s Pending Creatures</v-card-title>
            <PendingCreatures
              :creatures="pendingOffense"
              :interactive="attackerMoveActive"
              :selected-creature-id="props.selectedCreatureId"
              :can-leave-board="props.selectedCanLeaveBoard"
              class="px-2 pb-1"
              @select="emit('select', $event)"
              @remove="emit('remove')"
            />
          </div>
          <div v-if="pendingDefense.length > 0 || (defenderMoveActive && props.selectedCanLeaveBoard)">
            <v-card-title>{{ defender.name }}'s Pending Creatures</v-card-title>
            <PendingCreatures
              :creatures="pendingDefense"
              :interactive="defenderMoveActive"
              :selected-creature-id="props.selectedCreatureId"
              :can-leave-board="props.selectedCanLeaveBoard"
              class="px-2 pb-1"
              @select="emit('select', $event)"
              @remove="emit('remove')"
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
                :player-id="activeBattle.attacker"
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
                :player-id="activeBattle.defender"
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
import { TitanGame } from "@/models/game"
import { Player } from "@/models/player"
import { useGameStore } from "~/stores/game"
import { useBattleMoveStagingStore } from "~/stores/ui/battleMoveStaging"
import Creature from "../Creature.vue"
import PendingCreatures from "./PendingCreatures.vue"

const props = defineProps<{
  localPlayerIsDefender: boolean
  selectedCreatureId: number | undefined
  selectedCanLeaveBoard: boolean
}>()

const emit = defineEmits<{
  select: [creature: BattleCreature]
  remove: []
}>()

const game = useGameStore().game
const stagingStore = useBattleMoveStagingStore()

const minimized = ref(false)

const activeBattle = computed(() => game.activeBattle!)

const attackerMoveActive = computed(() => activeBattle.value.phase === BattlePhase.ATTACKER_MOVE)
const defenderMoveActive = computed(() => activeBattle.value.phase === BattlePhase.DEFENDER_MOVE)

const orderingClasses = computed(() => ({
  "flex-column-reverse": props.localPlayerIsDefender,
}))
const attacker = computed<Player>(() => TitanGame.getPlayerById(game, activeBattle.value.attacker))
const defender = computed<Player>(() => TitanGame.getPlayerById(game, activeBattle.value.defender))
const offense = computed<BattleCreature[]>(() =>
  activeBattle.value.creatures.filter(creature => creature.player === activeBattle.value.attacker),
)
const defense = computed<BattleCreature[]>(() =>
  activeBattle.value.creatures.filter(creature => creature.player === activeBattle.value.defender),
)
const pendingOffense = computed<BattleCreature[]>(() =>
  offense.value.filter((creature: BattleCreature) => stagingStore.hexOf(creature) >= 36),
)
const pendingDefense = computed<BattleCreature[]>(() =>
  defense.value.filter((creature: BattleCreature) => stagingStore.hexOf(creature) >= 36),
)
const deadOffense = computed<BattleCreature[]>(() =>
  offense.value.filter((creature: BattleCreature) => creature.hex === 0),
)
const deadDefense = computed<BattleCreature[]>(() =>
  defense.value.filter((creature: BattleCreature) => creature.hex === 0),
)
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
