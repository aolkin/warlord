import { map } from "lodash-es"

// Vuetify
import { createVuetify } from "vuetify"
import "vuetify/styles"
import { aliases } from "vuetify/iconsets/mdi-svg"
import { PlayerId } from "@/models/player"
import { mdi } from "./icons"

const titanColors = {
  "titan-white": "#fcfcfc",
  "titan-blue": "#077ec6",
  "titan-green": "#2d9e54",
  "titan-red": "#df271f",
  "titan-yellow": "#dfcf06",
  "titan-black": "#1f1e20",
  "titan-brown": "#8a2920",
  "titan-orange": "#ff6a00",
  "titan-purple": "#bd0cbd"
}

const playerColors = Object.fromEntries(map(titanColors,
  (color, name) => [`player-${PlayerId[name.split("-")[1].toUpperCase() as keyof typeof PlayerId]}`, color])
  .filter(entry => entry[0] !== "player-undefined"))

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  icons: {
    defaultSet: "mdi",
    // Vuetify's own chrome (checkboxes, radios, chip close buttons, etc.) references icons
    // through these aliases rather than literal "mdi-*" names; mdi-svg's aliases resolve
    // them to SVG path data directly, bypassing the "mdi" set below entirely.
    aliases,
    sets: {
      mdi
    }
  },
  defaults: {
    // Buttons render with uppercase text throughout the app.
    VBtn: {
      class: "text-uppercase"
    }
  },
  theme: {
    defaultTheme: "dark",
    themes: {
      dark: {
        dark: true,
        colors: {
          ...titanColors,
          ...playerColors
        }
      }
    }
  }
})
