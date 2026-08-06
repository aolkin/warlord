<template>
  <v-list density="compact">
    <v-list-item>
      <v-switch
        v-model="fancyGraphics"
        label="Fancy Graphics"
        inset
      />
    </v-list-item>
    <v-list-item>
      <v-switch
        v-model="quickDice"
        label="Quick Dice"
        inset
      />
    </v-list-item>
    <v-list-item>
      <v-switch
        v-model="freeMovement"
        label="Free Teleportation"
        inset
      />
    </v-list-item>
    <v-divider />
    <v-list-item>
      <v-btn
        block
        @click="reset"
      >
        Reset Game
      </v-btn>
    </v-list-item>
    <v-list-item>
      <v-btn
        block
        @click="persistToClipboard"
      >
        Persist
      </v-btn>
    </v-list-item>
    <v-list-item>
      <v-textarea
        v-model="saveText"
        class="save-data"
        bg-color="surface-variant"
        no-resize
        hide-details
        :rows="2"
        density="compact"
        variant="outlined"
      />
    </v-list-item>
    <v-list-item>
      <v-row>
        <v-col>
          <v-btn
            block
            @click="loadSave"
          >
            Load from Save
          </v-btn>
        </v-col>
        <v-col>
          <v-btn
            block
            @click="loadJson"
          >
            Load JSON
          </v-btn>
        </v-col>
      </v-row>
    </v-list-item>
    <v-divider />
    <v-list-item>
      <v-slider
        v-model="uiPlayer"
        label="Local Player"
        min="1"
        :max="players.length"
        step="1"
      />
    </v-list-item>
    <v-divider />
    <v-list-item>
      <v-slider
        v-model="diceQuantity"
        label="Dice to Roll"
        min="1"
        :max="18"
        step="1"
      />
      <v-btn
        block
        @click="roll"
      >
        Roll Dice
      </v-btn>
    </v-list-item>
    <v-divider />
    <v-list-item>
      <v-radio-group
        v-model="creatureColorMode"
        label="Creature Color Mode"
      >
        <v-radio
          v-for="(label, id) in colorModes"
          :key="id"
          :label="label"
          :value="id"
        />
      </v-radio-group>
    </v-list-item>
    <v-divider />
    <v-list-item>
      <v-list-item-title>Add Creature to Selected Stack</v-list-item-title>
    </v-list-item>
    <v-list-item
      v-for="(creature, type) in CREATURE_LIST"
      :key="type"
    >
      <v-btn
        block
        color="primary"
        @click="summon(creature)"
      >
        {{ creature.name }}
      </v-btn>
    </v-list-item>
  </v-list>
</template>

<script setup lang="ts">
import { computed, inject, Ref, ref } from "vue"
import DiceRoller from "~/components/ui/generic/DiceRoller"
import { Creature, CREATURE_LIST } from "~/models/creature"
import { useTypedStore } from "~/plugins/vuex"
import { useSelectionStore } from "~/stores/selection"
import { CreatureColorMode, usePreferencesStore } from "~/stores/ui/preferences"

const diceRoller = inject<Readonly<Ref<InstanceType<typeof DiceRoller> | null>>>("diceRoller")

const preferencesStore = usePreferencesStore()
const selectionStore = useSelectionStore()
const store = useTypedStore()

const diceQuantity = ref(1)
const saveText = ref("")

const localPlayer = computed(() => store.state.ui.localPlayer)
const players = computed(() => store.getters["game/players"])

const colorModes = computed(() => ({
  [CreatureColorMode.STANDARD]: "Standard",
  [CreatureColorMode.PLAYER]: "Player Color",
  [CreatureColorMode.STANDARD_UNIFORM_TEXT]: "Standard with Uniform Text",
  [CreatureColorMode.PLAYER_UNIFORM_TEXT]: "Player Color with Uniform Text"
}))

const fancyGraphics = computed({
  get: () => preferencesStore.fancyGraphics,
  set: (value: boolean) => preferencesStore.setFancyGraphics(value)
})

const quickDice = computed({
  get: () => preferencesStore.quickDice,
  set: (value: boolean) => preferencesStore.setQuickDice(value)
})

const freeMovement = computed({
  get: () => preferencesStore.freeMovement,
  set: (value: boolean) => preferencesStore.setFreeMovement(value)
})

const creatureColorMode = computed({
  get: () => `${preferencesStore.creatureColorMode}`,
  set: (value: string) => preferencesStore.setCreatureColorMode(Number(value))
})

const uiPlayer = computed({
  get: () => localPlayer.value + 1,
  set: (value: number) => store.commit("ui/setPlayer", value - 1)
})

function reset(): void {
  store.dispatch("reset")
}

function summon(creature: Creature): void {
  if (selectionStore.selectedStack !== undefined) {
    selectionStore.selectedStack.creatures.push(creature.type)
  }
}

function roll(): void {
  diceRoller?.value?.roll(diceQuantity.value)
}

async function persistToClipboard(): Promise<void> {
  const value = await store.dispatch("game/persist")
  if (value) {
    saveText.value = value
    await navigator.clipboard.writeText(value)
  }
}

function loadSave(): void {
  store.dispatch("game/restore", saveText.value)
}

function loadJson(): void {
  store.commit("game/rehydrate", JSON.parse(saveText.value))
}
</script>

<style scoped lang="sass">
.save-data
  font-size: 0.5em
</style>
