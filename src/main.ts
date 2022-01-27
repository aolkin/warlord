import { createApp } from "vue"
import App from "~/App.vue"
import vuetify from "~/plugins/vuetify"
import vuex from "~/plugins/vuex"
import { loadFonts } from "~/plugins/webfontloader"

void loadFonts()

const app = createApp(App)
  .use(vuetify)
  .use(vuex)

app.config.unwrapInjectedRef = true

app.mount("#app")
