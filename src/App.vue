<template>
  <v-app>
    <v-main>
      <Masterboard />
    </v-main>
  </v-app>
</template>

<script>
import Masterboard from "~/components/game/masterboard/Masterboard"

export default {
  name: "App",

  components: {
    Masterboard
  },

  data: () => ({})
}
</script>
