<template>
  <v-app>
    <v-main>
      <Masterboard />
    </v-main>
  </v-app>
</template>

<script>
import Masterboard from "~/components/game/masterboard/Masterboard"
import { defineComponent } from "@vue/runtime-core"

export default defineComponent({
  name: "App",

  components: {
    Masterboard
  },

  data: () => ({})
})
</script>
