<template>
  <div
    :style="{ height: game.players.length * 60 + 40 }"
    class="d-flex flex-column justify-space-between"
  >
    <div class="text-center round-label">
      Round
    </div>
    <div
      class="text-center round-counter"
      v-text="game.round + 1"
    />
    <v-card
      v-for="player in game.players"
      :key="player.id"
      :class="{ 'active': TitanGame.getActivePlayer(game) === player, [`bg-player-${player.id}`]: true }"
      class="player-card ml-2 mr-1 py-1 my-2"
      elevation="4"
    >
      <div
        class="text-center"
        v-text="TitanGame.getStacksForPlayer(game, player.id).length"
      />
      <v-tooltip right>
        <template #activator="{ props }">
          <div
            class="text-center"
            v-bind="props"
          >
            <v-icon icon="mdi-account-circle" />
          </div>
        </template>
        <span v-text="player.name" />
      </v-tooltip>
      <div
        class="text-center"
        v-text="game.score[player.id]"
      />
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { TitanGame } from "@/models/game"
import { useGameStore } from "~/stores/game"

const game = useGameStore().game
</script>

<style lang="sass" scoped>
.player-card:not(.active)
  filter: brightness(0.6)

.round-label, .round-counter
  font-family: "Pirata One", Serif

.round-label
  font-size: 1.25em
  text-transform: uppercase
  margin-bottom: -0.25em

.round-counter
  font-size: 1.5em
</style>
