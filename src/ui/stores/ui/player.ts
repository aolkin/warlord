import { defineStore } from "pinia"
import { ref } from "vue"

export const usePlayerStore = defineStore("player", () => {
  const localPlayer = ref(0)

  function setLocalPlayer(value: number): void {
    localPlayer.value = value
  }

  return {
    localPlayer,
    setLocalPlayer
  }
})
