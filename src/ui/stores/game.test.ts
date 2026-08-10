import { createPinia, setActivePinia } from "pinia"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { nextTick } from "vue"
import { MasterboardPhase } from "@/models/game"
import { useGameStore } from "~/stores/game"

describe("game store persistence watcher", () => {
  // jsdom's Storage doesn't route bracket-notation assignment through Storage.prototype.setItem
  // (unlike real browsers), so a real localStorage.setItem spy can't observe writes here; swap
  // in a plain object that can.
  const originalLocalStorage = globalThis.localStorage
  let store: Record<string, string>
  let writeCount: number

  beforeEach(() => {
    store = {}
    writeCount = 0
    const proxy = new Proxy(store, {
      set(target, prop, value) {
        writeCount++
        return Reflect.set(target, prop, value)
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).localStorage = proxy
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).localStorage = originalLocalStorage
  })

  // The Pinia instance is created inside the test, after the localStorage stub is in place, so
  // that the store's very first hydration is observable.
  it("does not write to localStorage on initial hydration, but coalesces every synchronous mutation in one action into a single write", async () => {
    setActivePinia(createPinia())

    const gameStore = useGameStore()
    await nextTick()
    expect(writeCount).toBe(0)

    gameStore.game.activePhase = MasterboardPhase.MOVE // a second mutation, still before any await
    await gameStore.game.setRoll(4)
    await nextTick()

    expect(writeCount).toBe(1)
    expect(store["warlord-v1"]).toContain("\"activeRoll\":4")
  })
})
