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
          class="ma-1"
        />
      </div>
    </v-card>
  </v-expand-transition>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapGetters } from "vuex"
import Creature from "../../game/Creature.vue"
import Marker from "../../game/Marker.vue"

export default defineComponent({
  name: "StackStatus",
  components: { Creature, Marker },
  computed: {
    ...mapGetters("ui/selections", ["focusedStack"])
  }
})
</script>

<style scoped lang="sass">

</style>
