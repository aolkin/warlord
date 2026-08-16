import { defineStore } from "pinia"
import { reactive, toRefs, watch } from "vue"

export enum CreatureColorMode {
  STANDARD,
  PLAYER,
  STANDARD_UNIFORM_TEXT,
  PLAYER_UNIFORM_TEXT,
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
  creatureColorMode: CreatureColorMode.STANDARD,
}

const loadPreferences = (): Preferences => {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === null
    ? { ...DEFAULT_PREFERENCES }
    : { ...DEFAULT_PREFERENCES, ...(JSON.parse(stored) as Partial<Preferences>) }
}

const savePreferences = (preferences: Preferences): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}

export const usePreferencesStore = defineStore("preferences", () => {
  const preferences = reactive(loadPreferences())

  watch(preferences, () => savePreferences({ ...preferences }), { deep: true })

  return toRefs(preferences)
})
