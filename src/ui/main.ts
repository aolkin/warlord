import { createApp } from "vue"
import App from "~/App.vue"
import pinia from "~/plugins/pinia"
import vuetify from "~/plugins/vuetify"
import vuex from "~/plugins/vuex"
import { loadFonts } from "~/plugins/webfontloader"

void loadFonts()

const app = createApp(App)
  .use(vuetify)
  .use(vuex)
  .use(pinia)

app.mount("#app")
