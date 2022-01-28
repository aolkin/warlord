<template>
  <v-expand-transition>
    <v-card v-if="focusedStack === undefined" class="ma-3" absolute top right width="340">
      <v-card-header>
        <v-card-subtitle>Hover over a stack to view details...</v-card-subtitle>
      </v-card-header>
    </v-card>
    <v-card v-else class="ma-3" absolute top right width="340">
      <v-card-header>
        <v-card-avatar>
          <Marker :color="focusedStack.player.color" :marker="focusedStack.marker" width="50" height="50" />
        </v-card-avatar>
        <v-card-header-text>{{ focusedStack.player.name }}</v-card-header-text>
      </v-card-header>
      <div class="px-2 pb-1">
        <Creature
          v-for="(creature, index) in focusedStack.creatures"
          :key="index"
          :type="creature"
          :player="focusedStack.player"
          :class="{ splitting: focusedStack.split[index], interactive: owned }"
          class="ma-1"
          @click="toggleSplit(index)"
        />
      </div>
      <div v-if="activePlayer === focusedStack.player">
        <v-card-actions v-if="activePhase === MasterboardPhase.SPLIT" class="split-guide">
          <v-card-text v-if="firstRound">
            You must split your starting creatures. Please select four creatures (including one lord) above
            to split into a separate stack.
            <div v-if="focusedStack?.isValidSplit(firstRound)" class="first-round-success">
              You have selected a valid split and may roll the die
              to start your turn!
            </div>
          </v-card-text>
          <v-card-text v-else-if="focusedStack.creatures.length < 4">
            You do not have enough creatures to split this stack.
          </v-card-text>
          <v-card-text v-else>
            You may select at least 2 and at most {{ focusedStack.creatures.length - 2 }} creatures to split
            into a new stack.
            <v-card-text class="text-left">
              <p>Remaining: {{ focusedStack.getCreatureSplit(false).map(c => CREATURES[c].name).join(", ") }}</p>
              <p>Splitting: {{ focusedStack.getCreatureSplit(true).map(c => CREATURES[c].name).join(", ") }}</p>
            </v-card-text>
          </v-card-text>
        </v-card-actions>
      </div>
    </v-card>
  </v-expand-transition>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapGetters, mapState } from "vuex"
import { CREATURE_DATA } from "~/models/creature"
import { MasterboardPhase } from "~/models/game"
import Creature from "../../game/Creature.vue"
import Marker from "../../game/Marker.vue"

export default defineComponent({
  name: "StackPanel",
  components: { Creature, Marker },
  data: () => ({
    MasterboardPhase,
    CREATURES: CREATURE_DATA
  }),
  computed: {
    ...mapState("game", ["activePhase", "firstRound"]),
    ...mapGetters("game", ["activePlayer"]),
    ...mapGetters("ui/selections", ["focusedStack"]),
    owned(): boolean {
      return this.activePlayer === this.focusedStack?.player
    }
  },
  methods: {
    toggleSplit(index: number) {
      if (this.focusedStack?.creatures.length > 2) {
        this.focusedStack.split[index] = !this.focusedStack?.split[index]
      }
    }
  }
})
</script>

<style scoped lang="sass">
.interactive
  cursor: pointer

.splitting
  outline: 4px dashed rgb(var(--v-theme-primary))
  outline-offset: -2px

.split-guide .v-card-text
  text-align: center

  .first-round-success
    font-size: 1.1em
    margin-top: 1em
    color: rgb(var(--v-theme-secondary))
</style>
