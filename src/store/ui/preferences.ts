export interface Preferences {
  fancyGraphics: boolean
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
  state: () => savedPreferences ?? {
    fancyGraphics: true
  },
  mutations: {
    setFancyGraphics(state: Preferences, payload: boolean) {
      state.fancyGraphics = payload
      savePreferences(state)
    }
  }
}
