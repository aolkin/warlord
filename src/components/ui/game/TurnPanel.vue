<template>
  <v-card
    border
    width="300"
    :prepend-icon="icon"
    :title="`${activePlayer.name}'s Turn`"
  >
    <template #prepend>
      <v-icon size="x-large" />
    </template>
    <v-card-text v-if="activePhase === MasterboardPhase.SPLIT">
      <span v-if="mayProceed">
        Split stacks if desired, or proceed to roll.
        <span v-if="sevenHighCount > 0">
          You have {{ sevenHighCount }} full stack{{ sevenHighCount > 1 ? 's' : '' }}!
        </span>
      </span>
      <span v-else>
        You must adjust your stack splits before rolling.
      </span>
    </v-card-text>
    <v-card-text v-else-if="activePhase === MasterboardPhase.MOVE">
      Moved {{ movedCount }} of {{ activeStacks.length }} stacks. {{ engagementsMessage }}
      <span v-if="movedCount < 1">
        You must move at least one stack!
      </span>
      <span v-else-if="!mayProceed">
        You must move at least one stack from each split if possible.
      </span>
    </v-card-text>
    <v-card-text v-else-if="activePhase === MasterboardPhase.MUSTER">
      Mustered a recruit in {{ musteredCount }} of {{ activeStacks.length }} stacks.
    </v-card-text>
    <v-fade-transition leave-absolute>
      <v-card-actions v-if="activePhase === MasterboardPhase.SPLIT">
        <v-btn
          block
          :disabled="!mayProceed"
          variant="outlined"
          @click="proceedToRoll"
        >
          Finish Splits and Roll
        </v-btn>
      </v-card-actions>
      <v-card-actions v-else-if="activePhase === MasterboardPhase.MOVE">
        <v-btn
          v-if="mulliganAvailable"
          block
          variant="outlined"
          title="On the first round only, you may opt to re-roll your die once."
          @click="roll"
        >
          Mulligan (Roll Again)
        </v-btn>
        <v-btn
          v-else
          block
          :variant="movedCount === activeStacks.length ? 'outlined' : 'tonal' "
          :disabled="!mayProceed"
          @click="nextPhase"
        >
          {{ engagedStacks.length > 0 ? "Proceed to Battle" : "Proceed to Muster" }}
        </v-btn>
      </v-card-actions>
      <v-card-actions v-else-if="activePhase === MasterboardPhase.MUSTER">
        <v-btn
          block
          variant="outlined"
          :disabled="!mayProceed"
          @click="nextPhase"
        >
          End Turn
        </v-btn>
      </v-card-actions>
    </v-fade-transition>
  </v-card>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import _ from "lodash"
import { mapActions, mapGetters, mapMutations, mapState } from "vuex"
import { MasterboardPhase } from "~/models/game"
import { Stack } from "~/models/stack"

export default defineComponent({
  name: "TurnPanel",
  inject: ["diceRoller"],
  data: () => ({
    MasterboardPhase
  }),
  computed: {
    ...mapState("game", ["activeRoll", "activePhase"]),
    ...mapGetters("game", [
      "activePlayer", "activeStacks", "mayProceed", "mulliganAvailable", "engagedStacks", "firstRound"
    ]),
    icon(): string {
      switch (this.activePhase) {
        case MasterboardPhase.SPLIT:
          return "mdi-call-split"
        case MasterboardPhase.MOVE:
          return `mdi-dice-${this.activeRoll ?? "multiple"}`
        case MasterboardPhase.BATTLE:
          return "mdi-sword-cross"
        case MasterboardPhase.MUSTER:
          return "mdi-account-multiple-plus"
        default:
          return "mdi-dice-multiple"
      }
    },
    sevenHighCount(): number {
      return _.sum(this.activeStacks.map((stack: Stack) => stack.creatures.length === 7))
    },
    movedCount(): number {
      return _.sum(this.activeStacks.map((stack: Stack) => stack.hasMoved()))
    },
    musteredCount(): number {
      return _.sum(this.activeStacks.map((stack: Stack) => stack.currentMuster !== undefined))
    },
    engagementsMessage(): string {
      if (this.engagedStacks.length < 1) {
        return ""
      } else if (this.engagedStacks.length === 1) {
        return "1 pending battle."
      } else {
        return `${this.engagedStacks.length} pending battles.`
      }
    }
  },
  methods: {
    ...mapActions("game", ["setRoll", "nextPhase"]),
    ...mapMutations("ui/selections", ["deselectStack"]),
    roll() {
      if (this.activeRoll !== undefined) {
        this.setRoll(undefined)
      }
      this.diceRoller.roll().then(async(roll: number[]) => await this.setRoll(roll[0]))
    },
    proceedToRoll() {
      this.deselectStack()
      this.nextPhase()
      this.roll()
    }
  }
})
</script>

<style scoped lang="sass">

</style>
