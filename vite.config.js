import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import vuetify from "vite-plugin-vuetify"

import path from "path"
import { fileURLToPath } from "url"

const configDir = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true, styles: "sass" })
  ],
  define: { "process.env": {} },
  resolve: {
    alias: {
      "~/utils": path.resolve(configDir, "src/utils"),
      "@/utils": path.resolve(configDir, "src/utils"),
      "~": path.resolve(configDir, "src/ui"),
      "@": path.resolve(configDir, "src/game")
    },
    extensions: [
      ".js",
      ".json",
      ".jsx",
      ".mjs",
      ".ts",
      ".tsx",
      ".vue"
    ]
  },
  test: {
    environment: "jsdom"
  }
})
