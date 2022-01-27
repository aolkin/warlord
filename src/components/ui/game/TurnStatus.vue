<template>
  <v-card class="ma-3" absolute bottom right width="300">
    <v-card-header>
      <v-card-header-text>{{ activePlayer.name }}'s Turn</v-card-header-text>
      <v-card-avatar>
        <v-icon :icon="icon" size="x-large" />
      </v-card-avatar>
    </v-card-header>
    <v-card-text>
      <span v-if="mustSplit">
        You must split your stack to proceed.
      </span>
      <span v-else-if="activePhase === MasterboardPhase.SPLIT">
        Split stacks if desired, or proceed to roll.
      </span>
    </v-card-text>
    <v-card-actions>
      <v-btn
        v-if="activeRoll === undefined"
        block
        :disabled="mustSplit"
        variant="outlined"
        @click="roll"
      >
        Finish Splits and Roll
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapGetters, mapMutations, mapState } from "vuex"
import { MasterboardPhase } from "~/models/game"

export default defineComponent({
  name: "TurnStatus",
  inject: ["diceRoller"],
  data: () => ({
    ...MasterboardPhase
  }),
  computed: {
    ...mapState("game", ["activeRoll", "activePhase"]),
    ...mapGetters("game", ["activePlayer"]),
    icon(): string {
      switch (this.activePhase) {
        case MasterboardPhase.SPLIT:
          return "mdi-call-split"
        case MasterboardPhase.MOVE:
          return `mdi-dice-${this.activeRoll ?? "multiple"}`
        default:
          return "mdi-dice-multiple"
      }
    },
    mustSplit() {
      return this.activePlayer.stacks.some(stack => stack.creatures.length > 7)
    }
  },
  methods: {
    ...mapMutations("game", ["setRoll"]),
    roll() {
      this.diceRoller.roll().then((roll: number[]) => this.setRoll(roll[0]))
    }
  }
})
</script>

<style scoped lang="sass">
</style>
