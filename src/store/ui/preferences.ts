export enum CreatureColorMode {
  STANDARD,
  PLAYER,
  STANDARD_UNIFORM_TEXT,
  PLAYER_UNIFORM_TEXT
}

export interface Preferences {
  fancyGraphics: boolean
  debugUi: boolean
  quickDice: boolean
  freeMovement: boolean
  creatureColorMode: CreatureColorMode
}

let savedPreferences: Preferences
const localPreferences = localStorage.getItem("titanPreferences")
if (localPreferences !== null) {
  savedPreferences = JSON.parse(localPreferences) as Preferences
}

const savePreferences = (state: Preferences): void => {
  localStorage.setItem("titanPreferences", JSON.stringify(state))
}

export default {
  namespaced: true,
  state: () => Object.assign({
    fancyGraphics: true,
    quickDice: false,
    freeMovement: false,
    creatureColorMode: CreatureColorMode.STANDARD
  }, savedPreferences ?? {}),
  mutations: {
    setFancyGraphics(state: Preferences, payload: boolean) {
      state.fancyGraphics = payload
      savePreferences(state)
    },
    setQuickDice(state: Preferences, payload: boolean) {
      state.quickDice = payload
      savePreferences(state)
    },
    setCreatureColorMode(state: Preferences, payload: CreatureColorMode) {
      state.creatureColorMode = payload
      savePreferences(state)
    },
    setFreeMovement(state: Preferences, payload: boolean) {
      state.freeMovement = payload
      savePreferences(state)
    },
    setDebugUi(state: Preferences, payload: boolean) {
      state.debugUi = payload
      savePreferences(state)
    }
  }
}
