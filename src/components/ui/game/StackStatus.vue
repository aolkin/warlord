<template>
  <v-card>
    Hello
  </v-card>
</template>

<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import { mapState } from "vuex"

export default defineComponent({
  name: "StackStatus",
  computed: {
    ...mapState("ui/selections")
  }
})
</script>

<style scoped lang="sass">

</style>
