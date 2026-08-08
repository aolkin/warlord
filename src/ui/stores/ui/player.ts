import { defineStore } from "pinia"
import { ref } from "vue"

export const usePlayerStore = defineStore("player", () => {
  const localPlayer = ref(0)

  return {
    localPlayer,
    setLocalPlayer: (value: number): void => {
      localPlayer.value = value
    }
  }
})
