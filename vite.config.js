import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

import path from "path"
import { fileURLToPath } from "url"

const configDir = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue()
  ],
  define: { "process.env": {} },
  resolve: {
    alias: {
      "~": path.resolve(configDir, "src"),
      "@": path.resolve(configDir, "src")
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
  }
})
