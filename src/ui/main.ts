import { createApp } from "vue"
import App from "~/App.vue"
import pinia from "~/plugins/pinia"
import vuetify from "~/plugins/vuetify"

const app = createApp(App).use(vuetify).use(pinia)

app.mount("#app")
