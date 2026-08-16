// Vuetify's built-in "mdi" icon set renders icon names as CSS classes, which requires
// @mdi/font's stylesheet for every Material Design Icon. This custom set instead resolves
// the same "mdi-*" icon names to SVG path data imported by name from @mdi/js, so the
// bundle only carries the icons the app actually references.
import { h } from "vue"
import type { IconProps, IconSet } from "vuetify"
import {
  mdiAccountCircle,
  mdiAccountMultiplePlus,
  mdiCallSplit,
  mdiCodeTags,
  mdiCog,
  mdiCursorMove,
  mdiDice1,
  mdiDice2,
  mdiDice3,
  mdiDice4,
  mdiDice5,
  mdiDice6,
  mdiDiceMultiple,
  mdiDotsHexagon,
  mdiHexagonMultipleOutline,
  mdiMenu,
  mdiNumeric1Box,
  mdiNumeric1BoxOutline,
  mdiNumeric2Box,
  mdiNumeric2BoxOutline,
  mdiNumeric3Box,
  mdiNumeric3BoxOutline,
  mdiNumeric4Box,
  mdiNumeric4BoxOutline,
  mdiNumeric5Box,
  mdiNumeric5BoxOutline,
  mdiNumeric6Box,
  mdiNumeric6BoxOutline,
  mdiNumeric7Box,
  mdiNumeric7BoxOutline,
  mdiNumeric8Box,
  mdiNumeric8BoxOutline,
  mdiNumeric9Box,
  mdiNumeric9BoxOutline,
  mdiNumeric10Box,
  mdiNumeric10BoxOutline,
  mdiShieldSword,
  mdiShimmer,
  mdiSword,
  mdiSwordCross,
  mdiWindowMinimize
} from "@mdi/js"

// Keyed by the same "mdi-*" strings used at v-icon call sites throughout src/ui.
const paths: Record<string, string> = {
  "mdi-account-circle": mdiAccountCircle,
  "mdi-account-multiple-plus": mdiAccountMultiplePlus,
  "mdi-call-split": mdiCallSplit,
  "mdi-code-tags": mdiCodeTags,
  "mdi-cog": mdiCog,
  "mdi-cursor-move": mdiCursorMove,
  "mdi-dice-1": mdiDice1,
  "mdi-dice-2": mdiDice2,
  "mdi-dice-3": mdiDice3,
  "mdi-dice-4": mdiDice4,
  "mdi-dice-5": mdiDice5,
  "mdi-dice-6": mdiDice6,
  "mdi-dice-multiple": mdiDiceMultiple,
  "mdi-dots-hexagon": mdiDotsHexagon,
  "mdi-hexagon-multiple-outline": mdiHexagonMultipleOutline,
  "mdi-menu": mdiMenu,
  "mdi-numeric-1-box": mdiNumeric1Box,
  "mdi-numeric-1-box-outline": mdiNumeric1BoxOutline,
  "mdi-numeric-2-box": mdiNumeric2Box,
  "mdi-numeric-2-box-outline": mdiNumeric2BoxOutline,
  "mdi-numeric-3-box": mdiNumeric3Box,
  "mdi-numeric-3-box-outline": mdiNumeric3BoxOutline,
  "mdi-numeric-4-box": mdiNumeric4Box,
  "mdi-numeric-4-box-outline": mdiNumeric4BoxOutline,
  "mdi-numeric-5-box": mdiNumeric5Box,
  "mdi-numeric-5-box-outline": mdiNumeric5BoxOutline,
  "mdi-numeric-6-box": mdiNumeric6Box,
  "mdi-numeric-6-box-outline": mdiNumeric6BoxOutline,
  "mdi-numeric-7-box": mdiNumeric7Box,
  "mdi-numeric-7-box-outline": mdiNumeric7BoxOutline,
  "mdi-numeric-8-box": mdiNumeric8Box,
  "mdi-numeric-8-box-outline": mdiNumeric8BoxOutline,
  "mdi-numeric-9-box": mdiNumeric9Box,
  "mdi-numeric-9-box-outline": mdiNumeric9BoxOutline,
  "mdi-numeric-10-box": mdiNumeric10Box,
  "mdi-numeric-10-box-outline": mdiNumeric10BoxOutline,
  "mdi-shield-sword": mdiShieldSword,
  "mdi-shimmer": mdiShimmer,
  "mdi-sword": mdiSword,
  "mdi-sword-cross": mdiSwordCross,
  "mdi-window-minimize": mdiWindowMinimize
}

// Mirrors Vuetify's own svg icon set (vuetify/lib/composables/icons.js's VSvgIcon), but
// looks the path up by name instead of requiring the caller to pass path data directly.
const component = (props: IconProps) => {
  const name = typeof props.icon === "string" ? props.icon : undefined
  const path = name === undefined ? undefined : paths[name]
  if (path === undefined) {
    console.warn(`No SVG path registered for icon "${String(props.icon)}"; add it to src/ui/plugins/icons.ts`)
  }
  return h(props.tag, [
    h("svg", {
      class: "v-icon__svg",
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      role: "img",
      "aria-hidden": "true"
    }, [h("path", { d: path ?? "" })])
  ])
}

export const mdi: IconSet = { component }
