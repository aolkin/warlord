<template>
  <v-card absolute bottom left class="ma-3">
    <v-card-title>Action</v-card-title>
    <v-card-title>
      Hex: {{ focusedBattleHex }} ({{ Hazard[land.getHazard(focusedBattleHex)] }})
      <span v-if="land.getElevation(focusedBattleHex) > 0">+{{ land.getElevation(focusedBattleHex) }}</span>
    </v-card-title>
  </v-card>
</template>
<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapGetters, mapState } from "vuex"
import { BattleBoard, Hazard } from "~/models/battle"

export default defineComponent({
  name: "ActionPanel",
  data: () => ({
    Hazard
  }),
  computed: {
    ...mapState("game", ["activeBattle"]),
    ...mapGetters("ui/selections", ["focusedBattleHex"]),
    land(): BattleBoard {
      return this.activeBattle.board
    }
  }
})
</script>
<style scoped lang="sass">
@import "@/styles/terrain-colors.sass"

@include battlemap-colors(".board :deep(.hex)", fill)

</style>
