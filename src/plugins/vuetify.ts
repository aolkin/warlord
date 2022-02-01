// Styles
import "@mdi/font/css/materialdesignicons.css"
import _ from "lodash"

// Vuetify
import { createVuetify } from "vuetify"
import "vuetify/styles"
import { PlayerId } from "~/models/player"

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

const playerColors = Object.fromEntries(_.map(titanColors,
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  (color, name) => [`player-${PlayerId[name.split("-")[1].toUpperCase()]}`, color])
  .filter(entry => entry[0] !== "player-undefined"))

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
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
