import _ from "lodash"
import { createApp } from "vue"
import App from "~/App.vue"
import vuetify from "~/plugins/vuetify"
import vuex from "~/plugins/vuex"
import { loadFonts } from "~/plugins/webfontloader"

(() => {
  let idCounter = _.random(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Object.prototype, "__guid", {
    writable: true
  })
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Object.prototype, "guid", {
    get: function() {
      if (this.__guid === undefined) {
        this.__guid = idCounter++
      }
      return this.__guid
    }
  })
})()

void loadFonts()

const app = createApp(App)
  .use(vuetify)
  .use(vuex)

app.config.unwrapInjectedRef = true

app.mount("#app")
