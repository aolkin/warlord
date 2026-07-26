import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript"
import pluginVue from "eslint-plugin-vue"

export default defineConfigWithVueTs(
  {
    name: "app/files-to-lint",
    files: ["src/**/*.{js,ts,vue}"]
  },
  {
    name: "app/ignores",
    ignores: ["dist/**", "node_modules/**", ".output/**"]
  },
  pluginVue.configs["flat/recommended"],
  vueTsConfigs.recommended,
  {
    name: "app/rules",
    rules: {
      // Core domain component names (Creature, Masterboard) predate this rule
      // and are used throughout the codebase; renaming them is a separate
      // concern from the ESLint upgrade.
      "vue/multi-word-component-names": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  },
  {
    name: "app/store-any",
    files: ["src/store/**/*.ts"],
    rules: {
      // Vuex 4's getter/action signatures (state, getters, rootState, rootGetters)
      // have no usable generic typing without a much larger store rewrite.
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
)
