<template>
  <v-list density="compact">
    <v-list-item>
      <v-switch
        v-model="preferencesStore.fancyGraphics"
        label="Fancy Graphics"
        inset
      />
    </v-list-item>
    <v-list-item>
      <v-switch
        v-model="preferencesStore.quickDice"
        label="Quick Dice"
        inset
      />
    </v-list-item>
    <v-list-item>
      <v-switch
        v-model="preferencesStore.freeMovement"
        label="Free Teleportation"
        inset
      />
    </v-list-item>
    <v-list-item>
      <v-switch
        v-model="preferencesStore.offscreenDice"
        label="Offscreen Dice Rendering"
        hint="Smoother dice rolls at the cost of a larger download; off renders on the main thread instead. Takes effect after reload."
        persistent-hint
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
        :max="gameStore.players.length"
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
import { Creature, CREATURE_LIST } from "@/models/creature"
import { useGameStore } from "~/stores/game"
import { usePlayerStore } from "~/stores/ui/player"
import { CreatureColorMode, usePreferencesStore } from "~/stores/ui/preferences"
import { useSelectionStore } from "~/stores/ui/selection"

const diceRoller = inject<Readonly<Ref<InstanceType<typeof DiceRoller> | null>>>("diceRoller")

const gameStore = useGameStore()
const preferencesStore = usePreferencesStore()
const playerStore = usePlayerStore()
const selectionStore = useSelectionStore()

const diceQuantity = ref(1)
const saveText = ref("")

const colorModes = computed(() => ({
  [CreatureColorMode.STANDARD]: "Standard",
  [CreatureColorMode.PLAYER]: "Player Color",
  [CreatureColorMode.STANDARD_UNIFORM_TEXT]: "Standard with Uniform Text",
  [CreatureColorMode.PLAYER_UNIFORM_TEXT]: "Player Color with Uniform Text"
}))

const creatureColorMode = computed({
  get: () => `${preferencesStore.creatureColorMode}`,
  set: (value: string) => { preferencesStore.creatureColorMode = Number(value) }
})

const uiPlayer = computed({
  get: () => playerStore.localPlayer + 1,
  set: (value: number) => playerStore.setLocalPlayer(value - 1)
})

function reset(): void {
  gameStore.reset()
  selectionStore.reset()
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
  const value = await gameStore.game.persist()
  if (value) {
    saveText.value = value
    await navigator.clipboard.writeText(value)
  }
}

function loadSave(): void {
  void gameStore.game.doRestore(saveText.value)
}

function loadJson(): void {
  gameStore.game.mRehydrate(JSON.parse(saveText.value))
}
</script>

<style scoped lang="sass">
.save-data
  font-size: 0.5em
</style>
