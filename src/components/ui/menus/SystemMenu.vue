<template>
  <v-list>
    <v-list-item>
      <v-list-item-header>Fancy Graphics</v-list-item-header>
      <v-switch
        v-model="fancyGraphics"
        inset
      />
    </v-list-item>
    <v-list-item>
      <v-btn block @click="reset">Reset Game</v-btn>
    </v-list-item>
    <v-list-item>
      <v-list-item-header>Local Player</v-list-item-header>
      <v-slider v-model="localPlayer" min="1" :max="players.length" step="1" />
    </v-list-item>
    <v-list-item>
      <v-list-item-header>Creature Color Mode</v-list-item-header>
      <v-radio-group v-model="creatureColorMode">
        <v-radio v-for="(label, id) in colorModes" :key="id" :label="label" :value="id" />
      </v-radio-group>
    </v-list-item>
    <v-list-item>
      <v-list-item-header>Add Creature to Selected Stack</v-list-item-header>
    </v-list-item>
    <v-list-item v-for="(creature, type) in CREATURE_LIST" :key="type">
      <v-btn block color="primary" @click="summon(creature)" v-text="creature.name" />
    </v-list-item>
  </v-list>
</template>

<script>
import { defineComponent } from "@vue/runtime-core"
import { mapActions, mapMutations, mapState } from "vuex"
import { CreatureColorMode } from "~/store/ui/preferences"
import { CREATURE_LIST } from "~/models/creature"

export default defineComponent({
  name: "SystemMenu",
  data: () => ({
    CREATURE_LIST
  }),
  computed: {
    ...mapState("ui", {
      preferences: state => state.preferences,
      selections: state => state.selections,
      activePlayer: state => state.activePlayer
    }),
    ...mapState("game", {
      players: state => state.players
    }),
    colorModes() {
      return {
        [CreatureColorMode.STANDARD]: "Standard",
        [CreatureColorMode.PLAYER]: "Player Color",
        [CreatureColorMode.STANDARD_UNIFORM_TEXT]: "Standard with Uniform Text",
        [CreatureColorMode.PLAYER_UNIFORM_TEXT]: "Player Color with Uniform Text"
      }
    },
    fancyGraphics: {
      get() {
        return this.preferences.fancyGraphics
      },
      set(value) {
        this.setFancyGraphics(value)
      }
    },
    creatureColorMode: {
      get() {
        return `${this.preferences.creatureColorMode}`
      },
      set(value) {
        this.setCreatureColorMode(Number(value))
      }
    },
    localPlayer: {
      get() {
        return this.activePlayer + 1
      },
      set(value) {
        this.setPlayer(value - 1)
      }
    }
  },
  methods: {
    ...mapMutations("ui", ["setPlayer"]),
    ...mapMutations("ui/preferences", ["setFancyGraphics", "setCreatureColorMode"]),
    ...mapActions(["reset"]),
    summon(creature) {
      if (this.selections.stack !== undefined) {
        this.$store.commit("game/muster", {
          stack: this.selections.stack,
          creature: creature.type
        })
      }
    }
  }
})
</script>

<style scoped>

</style>
