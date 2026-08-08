import { defineStore } from "pinia"
import { ref } from "vue"

export enum CreatureColorMode {
  STANDARD,
  PLAYER,
  STANDARD_UNIFORM_TEXT,
  PLAYER_UNIFORM_TEXT
}

interface Preferences {
  fancyGraphics: boolean
  debugUi: boolean
  quickDice: boolean
  freeMovement: boolean
  offscreenDice: boolean
  creatureColorMode: CreatureColorMode
}

const STORAGE_KEY = "titanPreferences"

const DEFAULT_PREFERENCES: Preferences = {
  fancyGraphics: true,
  debugUi: false,
  quickDice: false,
  freeMovement: false,
  offscreenDice: true,
  creatureColorMode: CreatureColorMode.STANDARD
}

const loadPreferences = (): Preferences => {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === null
    ? { ...DEFAULT_PREFERENCES }
    : { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) as Partial<Preferences> }
}

const savePreferences = (preferences: Preferences): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}

export const usePreferencesStore = defineStore("preferences", () => {
  const initial = loadPreferences()
  const fancyGraphics = ref(initial.fancyGraphics)
  const debugUi = ref(initial.debugUi)
  const quickDice = ref(initial.quickDice)
  const freeMovement = ref(initial.freeMovement)
  const offscreenDice = ref(initial.offscreenDice)
  const creatureColorMode = ref(initial.creatureColorMode)

  const persist = (): void => savePreferences({
    fancyGraphics: fancyGraphics.value,
    debugUi: debugUi.value,
    quickDice: quickDice.value,
    freeMovement: freeMovement.value,
    offscreenDice: offscreenDice.value,
    creatureColorMode: creatureColorMode.value
  })

  function setFancyGraphics(value: boolean): void {
    fancyGraphics.value = value
    persist()
  }

  function setDebugUi(value: boolean): void {
    debugUi.value = value
    persist()
  }

  function setQuickDice(value: boolean): void {
    quickDice.value = value
    persist()
  }

  function setFreeMovement(value: boolean): void {
    freeMovement.value = value
    persist()
  }

  function setOffscreenDice(value: boolean): void {
    offscreenDice.value = value
    persist()
  }

  function setCreatureColorMode(value: CreatureColorMode): void {
    creatureColorMode.value = value
    persist()
  }

  return {
    fancyGraphics,
    debugUi,
    quickDice,
    freeMovement,
    offscreenDice,
    creatureColorMode,
    setFancyGraphics,
    setDebugUi,
    setQuickDice,
    setFreeMovement,
    setOffscreenDice,
    setCreatureColorMode
  }
})
