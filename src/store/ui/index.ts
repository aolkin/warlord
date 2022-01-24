import preferences, { Preferences } from "./preferences"

export interface UiState {
  preferences: Preferences
}

export default {
  namespaced: true,
  modules: {
    preferences
  }
}
