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
          <Marker :color="focusedStack.owner" :marker="focusedStack.marker" width="50" height="50" />
        </v-card-avatar>
        <v-card-header-text>
          {{ stackPlayer.name }}
          ({{ focusedStack.creatures.length }} creatures)
        </v-card-header-text>
      </v-card-header>
      <div class="px-2 pb-1">
        <Creature
          v-for="(creature, index) in focusedStack.creatures"
          :key="index"
          :type="creature"
          :player="stackPlayer"
          :class="{ splitting: focusedStack.split[index], interactive: owned }"
          class="ma-1"
          @click="toggleSplit(index)"
        />
      </div>
      <template v-if="activePlayerId === focusedStack.owner">
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
              <p>Remaining: {{ focusedStack.getCreaturesSplit(false).map(c => CREATURES[c].name).join(", ") }}</p>
              <p>Splitting: {{ focusedStack.getCreaturesSplit(true).map(c => CREATURES[c].name).join(", ") }}</p>
            </v-card-text>
          </v-card-text>
        </v-card-actions>
        <template v-else-if="activePhase === MasterboardPhase.MUSTER">
          <v-card-title>Muster Options</v-card-title>
          <div class="px-2 pb-1">
            <template v-for="[creature, musterBasis] in musterable" :key="creature">
              <v-dialog>
                <template #activator="{ props }">
                  <Creature
                    :type="creature"
                    :player="stackPlayer"
                    :class="{ interactive: musterBasis.length > 0, unavailable: musterBasis.length < 1 }"
                    class="ma-1"
                    v-bind="musterBasis.length > 0 ? props : {}"
                  />
                </template>
                <v-card>
                  <v-card-title>Muster a {{ CREATURES[creature].name }} with...</v-card-title>
                  <v-card-actions>
                    <svg
                      v-for="([basisCreature, count], index) in musterBasis"
                      :key="index"
                      viewBox="-50 -50 100 100"
                      class="muster-basis-choice pa-2"
                    >
                      <Creature :type="basisCreature" :player="stackPlayer" :in-svg="true" />
                      <text x="0" y="0" class="req-count">x{{ count }}</text>
                    </svg>
                  </v-card-actions>
                </v-card>
              </v-dialog>
            </template>
          </div>
        </template>
      </template>
    </v-card>
  </v-expand-transition>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapGetters, mapState } from "vuex"
import { CREATURE_DATA, CreatureType } from "~/models/creature"
import { MasterboardPhase } from "~/models/game"
import masterboard from "~/models/masterboard"
import { Player } from "~/models/player"
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
    ...mapGetters("game", ["activePlayerId", "playerById"]),
    ...mapGetters("ui/selections", ["focusedStack"]),
    owned(): boolean {
      return this.activePlayerId === this.focusedStack?.owner
    },
    stackPlayer(): Player | undefined {
      return this.playerById(this.focusedStack?.owner)
    },
    musterable(): CreatureType[] {
      return this.focusedStack?.musterable(masterboard.getHex(this.focusedStack?.hex).terrain)
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

.unavailable
  cursor: not-allowed
  filter: saturate(0.5) brightness(0.5)

.muster-basis-choice
  //max-width: 160px
  //margin: auto

  .req-count
    font-family: "Eczar", serif
    font-weight: 600
    font-size: 36pt
    fill: rgb(var(--v-theme-secondary))
    text-shadow: 2px 2px black
    text-anchor: middle
    dominant-baseline: central
</style>
