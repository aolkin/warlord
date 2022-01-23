import { createApp } from "vue"
import App from "~/App.vue"
import vuetify from "~/plugins/vuetify"
import vuex from "~/plugins/vuex"
import { loadFonts } from "~/plugins/webfontloader"

void loadFonts()

createApp(App)
  .use(vuetify)
  .use(vuex)
  .mount("#app")
