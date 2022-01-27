<template>
  <v-app>
    <v-navigation-drawer
      class="menu-drawer"
      color="grey-darken-3"
      permanent
      width="48"
    >
      <div>
        <v-btn icon="mdi-menu" variant="plain" @click="menuVisible = !menuVisible" />
        <v-btn
          :variant="view === Views.MASTERBOARD ? 'text' : 'plain'"
          icon="mdi-dots-hexagon"
          @click="view = Views.MASTERBOARD"
        />
        <v-btn
          :variant="view === Views.BATTLEBOARD ? 'text' : 'plain'"
          icon="mdi-hexagon-multiple-outline"
          @click="view = Views.BATTLEBOARD"
        />
      </div>
      <PlayerStatus />
      <div>
        <v-btn icon="mdi-shimmer" variant="plain" @click="toggleFancyGraphics" />
        <v-btn icon="mdi-cog" variant="plain" @click="prefsPaneVisible = !prefsPaneVisible" />
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
      <!-- Constructing the boards is very expensive, so we hide them with v-show instead of
           destroying and recreating them with v-if -->
      <Masterboard v-show="view === Views.MASTERBOARD" />
      <div v-show="view === Views.BATTLEBOARD" />
      <DiceRoller ref="diceRoller" />
    </v-main>
    <v-app-bar color="grey-darken-3" height="30" position="bottom">Status</v-app-bar>
  </v-app>
</template>

<script lang="ts">
import { defineComponent, provide, readonly, ref } from "@vue/runtime-core"
import Masterboard from "~/components/game/masterboard/Masterboard"
import PlayerStatus from "~/components/ui/game/PlayerStatus"
import DiceRoller from "~/components/ui/generic/DiceRoller"
import GameMenu from "~/components/ui/menus/GameMenu"
import SystemMenu from "~/components/ui/menus/SystemMenu"

export enum Views {
  MASTERBOARD,
  BATTLEBOARD
}

export default defineComponent({
  name: "App",
  components: {
    DiceRoller,
    PlayerStatus,
    SystemMenu,
    GameMenu,
    Masterboard
  },
  setup() {
    const diceRoller = ref(null)
    provide("diceRoller", readonly(diceRoller))
    return { diceRoller }
  },
  data: () => ({
    Views: Views,
    view: Views.MASTERBOARD,
    menuVisible: false,
    prefsPaneVisible: false
  }),
  computed: {},
  methods: {
    toggleFancyGraphics() {
      this.$store.commit("ui/preferences/setFancyGraphics",
        !this.$store.state.ui.preferences.fancyGraphics)
    }
  }
})
</script>

<style lang="sass" scoped>
:deep(.menu-drawer) > div.v-navigation-drawer__content
  display: flex
  flex-direction: column
  justify-content: space-between
</style>
