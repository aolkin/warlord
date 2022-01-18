<template>
  <v-app>
    <v-main>
      <HelloWorld/>
    </v-main>
  </v-app>
</template>

<script>
import HelloWorld from './components/HelloWorld.vue'
import {Masterboard} from "@/models/masterboard";

export default {
  name: 'App',

  components: {
    HelloWorld,
  },

  data: () => ({
    masterboard: new Masterboard(),
  }),
}
</script>
