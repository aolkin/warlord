<template>
  <v-app>
    <v-navigation-drawer
      class="menu-drawer"
      color="grey-darken-3"
      permanent
      width="48"
    >
      <div>
        <v-btn
          icon="mdi-menu"
          variant="plain"
          @click="menuVisible = !menuVisible"
        />
        <v-btn
          :variant="!battleVisible ? 'text' : 'plain'"
          icon="mdi-dots-hexagon"
          @click="battleVisible = false"
        />
        <v-btn
          :variant="battleVisible ? 'text' : 'plain'"
          :disabled="!activeBattle"
          icon="mdi-hexagon-multiple-outline"
          @click="battleVisible = true"
        />
      </div>
      <PlayerStatus />
      <div>
        <v-btn
          icon="mdi-code-tags"
          variant="plain"
          @click="toggleDebugUi"
        />
        <v-btn
          icon="mdi-shimmer"
          variant="plain"
          @click="toggleFancyGraphics"
        />
        <v-btn
          icon="mdi-cog"
          variant="plain"
          @click="prefsPaneVisible = !prefsPaneVisible"
        />
      </div>
    </v-navigation-drawer>
    <v-navigation-drawer
      v-model="menuVisible"
      color="grey-darken-2"
      temporary
    >
      <GameMenu />
    </v-navigation-drawer>
    <v-navigation-drawer
      v-model="prefsPaneVisible"
      color="grey-darken-2"
      width="400"
      temporary
    >
      <SystemMenu />
    </v-navigation-drawer>
    <v-main>
      <Masterboard v-show="!battleVisible" />
      <BattleBoard
        v-if="activeBattle"
        v-show="battleVisible"
        :battle="activeBattle"
      />
      <DiceRoller ref="diceRoller" />
    </v-main>
    <v-footer
      app
      color="grey-darken-3"
      location="bottom"
      height="32"
      class="px-2 py-1"
    >
      Status
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, provide, readonly, ref, watch } from "vue"
import type { Battle } from "@/models/battle"
import BattleBoard from "~/components/game/battle/BattleBoard"
import Masterboard from "~/components/game/masterboard/Masterboard"
import PlayerStatus from "~/components/ui/game/PlayerStatus"
import type DiceRollerComponent from "~/components/ui/generic/DiceRoller"
import GameMenu from "~/components/ui/menus/GameMenu"
import SystemMenu from "~/components/ui/menus/SystemMenu"
import { useGameStore } from "~/stores/game"
import { usePreferencesStore } from "~/stores/ui/preferences"

// Keeps @3d-dice/dice-box's chunks out of the main bundle for sessions that never roll dice.
const DiceRoller = defineAsyncComponent(() => import("~/components/ui/generic/DiceRoller"))

const diceRoller = ref<InstanceType<typeof DiceRollerComponent> | null>(null)
provide("diceRoller", readonly(diceRoller))

const gameStore = useGameStore()
const preferencesStore = usePreferencesStore()

const menuVisible = ref(false)
const prefsPaneVisible = ref(false)

const battleVisible = ref(false)

// game is deeply reactive, and Vue's UnwrapNestedRefs can't reconstruct Battle's
// private methods, so the inferred type structurally mismatches the class - cast it back.
const activeBattle = computed(() => gameStore.game.activeBattle as Battle | undefined)

// Only the empty->present transition should navigate to the battle board - subsequent
// mutations within the same battle (strikes, wounds, etc.) also change activeBattle. Firing
// immediately covers the case where a battle is already active on mount. The reverse
// transition forces the battle board back out of view, since the toggle button is disabled
// without an active battle and so can no longer do that itself.
watch(() => activeBattle.value !== undefined, (hasBattle, hadBattle) => {
  if (hasBattle && !hadBattle) {
    battleVisible.value = true
  } else if (hadBattle && !hasBattle) {
    battleVisible.value = false
  }
}, { immediate: true })

function toggleFancyGraphics(): void {
  preferencesStore.fancyGraphics = !preferencesStore.fancyGraphics
}

function toggleDebugUi(): void {
  preferencesStore.debugUi = !preferencesStore.debugUi
}
</script>

<style lang="sass" scoped>
:deep(.menu-drawer) > div.v-navigation-drawer__content
  display: flex
  flex-direction: column
  justify-content: space-between
</style>
