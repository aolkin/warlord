<template>
  <div>
    <Creature
      v-if="activePhase === MasterboardPhase.MUSTER"
      :type="undefined"
      :player="player"
      :class="{ selected: chosen === undefined }"
      class="ma-1 recruitment-choice"
      @click="chosen = undefined"
    />
    <template v-for="([creature, musterBasis], index) in musterable" :key="creature">
      <v-dialog v-model="dialogState[index]">
        <template #activator="{ props }">
          <Creature
            :type="creature"
            :player="player"
            :class="{ unavailable: creature !== undefined && musterBasis.length < 1,
                      selected: chosen !== undefined && creature === chosen[0] }"
            class="ma-1 recruitment-choice"
            v-bind="musterBasis.length > 1 ? props : {}"
            @click="musterBasis.length === 1 && choose([creature, musterBasis[0]])"
          />
        </template>
        <v-card>
          <v-card-title>Muster a {{ CREATURES[creature].name }} with...</v-card-title>
          <v-card-actions>
            <svg
              v-for="[basisCreature, count] in musterBasis"
              :key="basisCreature"
              viewBox="-50 -50 100 100"
              class="muster-basis-choice pa-2"
              @click="choose([creature, [basisCreature, count]])"
            >
              <Creature :type="basisCreature" :player="player" :in-svg="true" />
              <text x="0" y="0" class="req-count">x{{ count }}</text>
            </svg>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>
  </div>
</template>
<script lang="ts">
import { defineComponent } from "@vue/runtime-core"
import _ from "lodash"
import { mapState } from "vuex"
import { CREATURE_DATA } from "~/models/creature"
import { MasterboardPhase } from "~/models/game"
import { Player } from "~/models/player"
import { MusterPossibility } from "~/models/stack"
import Creature from "../../game/Creature.vue"

export default defineComponent({
  name: "MusterChoices",
  components: { Creature },
  props: {
    musterable: {
      type: Array,
      required: false,
      default: () => []
    },
    player: {
      type: Player,
      required: false,
      default: undefined
    },
    modelValue: {
      type: Array, // MusterPossibility
      required: false,
      default: undefined
    }
  },
  emits: ["update:modelValue"],
  data() {
    return {
      MasterboardPhase,
      CREATURES: CREATURE_DATA,
      dialogState: this.musterable.map(() => false)
    }
  },
  computed: {
    ...mapState("game", ["activePhase"]),
    chosen: {
      get() {
        return this.modelValue
      },
      set(value: MusterPossibility) {
        this.$emit("update:modelValue", value)
      }
    }
  },
  watch: {
    musterable(value) {
      this.dialogState = value.map(() => false)
    }
  },
  methods: {
    choose(possibility: MusterPossibility) {
      this.chosen = possibility
      _.fill(this.dialogState, false)
    }
  }
})
</script>
<style scoped lang="sass">
.recruitment-choice
  cursor: pointer

  &.unavailable
    cursor: not-allowed
    filter: saturate(0.5) brightness(0.5)

  &.selected
    outline: 4px solid rgb(var(--v-theme-primary))
    outline-offset: -2px

.muster-basis-choice
  cursor: pointer
  user-select: none
  width: 160px
  margin: auto

  .req-count
    font-family: "Eczar", serif
    font-weight: 600
    font-size: 36pt
    fill: rgb(var(--v-theme-primary))
    text-shadow: 2px 2px black
    text-anchor: middle
    dominant-baseline: central

</style>
