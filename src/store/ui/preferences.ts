export interface Preferences {
  fancyGraphics: boolean
}

export default {
  namespaced: true,
  state: () => ({
    fancyGraphics: true
  })
}
