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
          :variant="view === View.MASTERBOARD ? 'text' : 'plain'"
          icon="mdi-dots-hexagon"
          @click="view = View.MASTERBOARD"
        />
        <v-btn
          :variant="view === View.BATTLEBOARD ? 'text' : 'plain'"
          icon="mdi-hexagon-multiple-outline"
          @click="view = View.BATTLEBOARD"
        />
      </div>
      <PlayerStatus />
      <div>
        <v-btn icon="mdi-code-tags" variant="plain" @click="toggleDebugUi" />
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
      <Masterboard v-show="view === View.MASTERBOARD" />
      <BattleBoard v-show="view === View.BATTLEBOARD" />
      <DiceRoller ref="diceRoller" />
    </v-main>
    <v-app-bar color="grey-darken-3" height="30" location="bottom">Status</v-app-bar>
  </v-app>
</template>

<script lang="ts">
import { defineComponent, provide, readonly, ref } from "@vue/runtime-core"
import { mapMutations, mapState } from "vuex"
import BattleBoard from "~/components/game/battle/BattleBoard"
import Masterboard from "~/components/game/masterboard/Masterboard"
import PlayerStatus from "~/components/ui/game/PlayerStatus"
import DiceRoller from "~/components/ui/generic/DiceRoller"
import GameMenu from "~/components/ui/menus/GameMenu"
import SystemMenu from "~/components/ui/menus/SystemMenu"
import { View } from "~/store/ui/selection"

export default defineComponent({
  name: "App",
  components: {
    BattleBoard,
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
    View: View,
    menuVisible: false,
    prefsPaneVisible: false
  }),
  computed: {
    ...mapState("ui", ["selections"]),
    view: {
      get(): View {
        return this.selections.view
      },
      set(value: View) {
        this.setView(value)
      }
    }
  },
  methods: {
    ...mapMutations("ui/selections", ["setView"]),
    toggleFancyGraphics() {
      this.$store.commit("ui/preferences/setFancyGraphics",
        !this.$store.state.ui.preferences.fancyGraphics)
    },
    toggleDebugUi() {
      this.$store.commit("ui/preferences/setDebugUi",
        !this.$store.state.ui.preferences.debugUi)
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
