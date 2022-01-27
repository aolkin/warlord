<template>
  <div :style="{ height: players.length * 60 }" class="d-flex flex-column justify-space-between">
    <v-card
      v-for="(player, index) in players"
      :key="index"
      :style="{ backgroundColor: player.getColor() }"
      :class="{ 'active': activePlayer === player }"
      class="player-card ml-2 mr-1 py-1 my-2"
      elevation="4"
    >
      <div class="text-center" v-text="player.stacks.length" />
      <v-tooltip right>
        <template #activator="{ props }">
          <div class="text-center" v-bind="props">
            <v-icon icon="mdi-account-circle" />
          </div>
        </template>
        <span v-text="player.name" />
      </v-tooltip>
      <div class="text-center" v-text="player.score" />
    </v-card>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapGetters, mapState } from "vuex"

export default defineComponent({
  name: "PlayerStatus",
  computed: {
    ...mapState("game", ["players"]),
    ...mapGetters("game", ["activePlayer"])
  }
})
</script>

<style lang="sass" scoped>
.player-card:not(.active)
  filter: brightness(0.6)
</style>
