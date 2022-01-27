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
      <v-slider v-model="activePlayer" min="0" max="1" ticks thumb-label />
    </v-list-item>
  </v-list>
</template>

<script>
import { defineComponent } from "@vue/runtime-core"
import { mapActions, mapMutations, mapState } from "vuex"

export default defineComponent({
  name: "SystemMenu",
  computed: {
    ...mapState("ui", {
      preferences: state => state.preferences,
      activePlayer: state => state.activePlayer
    }),
    fancyGraphics: {
      get() {
        return this.preferences.fancyGraphics
      },
      set(value) {
        this.setFancyGraphics(value)
      }
    },
    activePlayer: {
      get() {
        return this.activePlayer
      },
      set(value) {
        this.setPlayer(value)
      }
    }
  },
  methods: {
    ...mapMutations("ui", ["setPlayer"]),
    ...mapMutations("ui/preferences", ["setFancyGraphics"]),
    ...mapActions(["reset"])
  }
})
</script>

<style scoped>

</style>
