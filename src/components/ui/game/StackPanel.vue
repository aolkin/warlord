<template>
  <v-expand-transition>
    <v-card
      v-if="focusedStack === undefined"
      border
      width="342"
      subtitle="Hover over a stack to view details..."
      v-bind="$props as any"
    />
    <v-card
      v-else
      :elevation="focusedStack === selectedStack ? 24 : 0"
      class="root-card"
      border
      width="342"
      v-bind="$props as any"
    >
      <v-card-actions
        v-if="selectedStack === focusedStack"
        class="justify-space-between"
      >
        <v-btn @click="cycleStacks(-1)">
          Previous Stack
        </v-btn>
        <v-btn @click="cycleStacks(1)">
          Next Stack
        </v-btn>
      </v-card-actions>
      <v-card-item :title="`${stackPlayer?.name} (${focusedStack.creatures.length} creatures)`">
        <template #prepend>
          <PlayerMarker
            :color="focusedStack.owner"
            :marker="focusedStack.marker"
            width="50"
            height="50"
          />
        </template>
      </v-card-item>

      <div class="px-2 pb-1">
        <Creature
          v-for="(creature, index) in (focusedStack.creatures as CreatureType[])"
          :key="index"
          :type="creature"
          :player="stackPlayer"
          :class="{ splitting: focusedStack.split[index],
                    interactive: activePhase === MasterboardPhase.SPLIT && owned }"
          class="ma-1"
          @click="toggleSplit(index)"
        />
      </div>
      <template v-if="activePlayerId === focusedStack.owner">
        <v-card-actions
          v-if="activePhase === MasterboardPhase.SPLIT"
          class="split-guide"
        >
          <v-card-text v-if="firstRound">
            You must split your starting creatures. Please select four creatures (including one lord) above
            to split into a separate stack.
            <div
              v-if="focusedStack?.isValidSplit(firstRound)"
              class="first-round-success"
            >
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
            <div
              v-if="focusedStack.getCreaturesSplit(true).length > 0"
              class="text-left mt-5"
            >
              <p>Remaining: {{ focusedStack.getCreaturesSplit(false).map((c: CreatureType) => CREATURES[c].name).join(", ") }}</p>
              <p>Splitting: {{ focusedStack.getCreaturesSplit(true).map((c: CreatureType) => CREATURES[c].name).join(", ") }}</p>
            </div>
          </v-card-text>
        </v-card-actions>
        <template
          v-else-if="activePhase === MasterboardPhase.MUSTER ||
            (activePhase === MasterboardPhase.MOVE &&
              focusedHex !== undefined && focusedStack.hex !== focusedHex.id)"
        >
          <v-card-title>Mustering Options ({{ musteringTerrainName }})</v-card-title>
          <MusterChoice
            v-if="activePhase === MasterboardPhase.MOVE || focusedStack.canMuster()"
            v-model="mustering"
            class="px-2 pb-1"
            :musterable="musterable"
            :player="stackPlayer"
          />
          <v-card-subtitle
            v-if="activePhase === MasterboardPhase.MUSTER"
            class="mb-3"
          >
            {{ musteringCaption }}
          </v-card-subtitle>
        </template>
      </template>
    </v-card>
  </v-expand-transition>
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { capitalize } from "lodash-es"
import { mapActions, mapGetters, mapState } from "vuex"
import { CREATURE_DATA, CreatureType } from "~/models/creature"
import { MasterboardPhase } from "~/models/game"
import masterboard, { MasterboardHex, Terrain } from "~/models/masterboard"
import { Player } from "~/models/player"
import { MusterChoice, MusterPossibility, Stack } from "~/models/stack"
import { useSelectionStore } from "~/stores/selection"
import { mod } from "~/utils/math"
import Creature from "../../game/Creature.vue"
import PlayerMarker from "../../game/Marker.vue"
import MusterChoices from "./MusterChoices.vue"

export default defineComponent({
  name: "StackPanel",
  components: { MusterChoice: MusterChoices, Creature, PlayerMarker },
  setup() {
    return { selectionStore: useSelectionStore() }
  },
  data: () => ({
    MasterboardPhase,
    Terrain,
    CREATURES: CREATURE_DATA
  }),
  computed: {
    ...mapState("game", ["activePhase", "round"]),
    ...mapGetters("game", ["activePlayerId", "playerById", "firstRound", "activeStacks"]),
    focusedStack(): Stack | undefined {
      return this.selectionStore.focusedStack
    },
    focusedHex(): MasterboardHex | undefined {
      return this.selectionStore.focusedHex
    },
    selectedStack(): Stack | undefined {
      return this.selectionStore.selectedStack
    },
    owned(): boolean {
      return this.activePlayerId === this.focusedStack?.owner
    },
    stackPlayer(): Player | undefined {
      return this.playerById(this.focusedStack?.owner)
    },
    musteringTerrain(): Terrain {
      return this.activePhase === MasterboardPhase.MUSTER
        ? masterboard.getHex(this.focusedStack?.hex as number).terrain
        : this.focusedHex?.terrain as Terrain
    },
    musteringTerrainName(): string {
      return capitalize(Terrain[this.musteringTerrain])
    },
    musterable(): MusterPossibility[] {
      return this.focusedStack?.musterable(this.musteringTerrain) as MusterPossibility[]
    },
    mustering: {
      get() {
        return this.focusedStack?.currentMuster
      },
      set(value: MusterChoice) {
        if (this.activePhase !== MasterboardPhase.MUSTER) {
          return
        }
        this.setRecruit({ stack: this.focusedStack, recruit: value })
      }
    },
    musteringCaption() {
      const stack = this.focusedStack!
      if (!stack.canMuster()) {
        if (!stack.hasMoved()) {
          return "You cannot muster in a stack that did not move this turn."
        } else if (stack.creatures.length > 6) {
          return "This stack is already full and cannot muster."
        } else {
          return "This stack cannot muster."
        }
      } else if (stack.currentMuster === undefined) {
        return "No recruit chosen."
      } else {
        let caption = "Mustering " + CREATURE_DATA[stack.currentMuster[0] as CreatureType].name
        if (stack.currentMuster[1][1] > 0) {
          caption += " with "
          if (stack.currentMuster[1][1] > 1) {
            caption += `${stack.currentMuster[1][1]}x `
          }
          caption += CREATURE_DATA[stack.currentMuster[1][0] as CreatureType].name
        }
        return caption
      }
    }
  },
  methods: {
    ...mapActions("game", ["setRecruit"]),
    toggleSplit(index: number) {
      if (this.activePhase === MasterboardPhase.SPLIT && (this.focusedStack?.creatures.length ?? 0) > 2) {
        this.focusedStack!.split[index] = !this.focusedStack!.split[index]
      }
    },
    cycleStacks(by: number) {
      let index = this.activeStacks.indexOf(this.selectedStack)
      let candidateStack: Stack
      do {
        index += by
        candidateStack = this.activeStacks[mod(index, this.activeStacks.length)]
      } while ((this.activePhase === MasterboardPhase.MOVE && candidateStack.hasMoved()) ||
      (this.activePhase === MasterboardPhase.MUSTER && !candidateStack.canMuster()))
      this.selectionStore.selectStack(candidateStack)
    }
  }
})
</script>

<style scoped lang="sass">
.root-card
  transition: .2s ease-out

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
