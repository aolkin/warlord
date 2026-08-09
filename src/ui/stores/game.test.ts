import { createPinia, setActivePinia } from "pinia"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { nextTick } from "vue"
import { MasterboardPhase } from "@/models/game"
import { useGameStore } from "~/stores/game"

describe("game store", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useGameStore().reset()
  })

  it("derives getters that build on other getters", () => {
    const gameStore = useGameStore()

    expect(gameStore.activePlayerId).toBe(gameStore.activePlayer.id)
    expect(gameStore.activeStacks).toEqual(gameStore.game.getStacksForPlayer(gameStore.activePlayerId))
  })

  it("advances the phase and splits stacks through its own action", async () => {
    const gameStore = useGameStore()
    const stack = gameStore.activeStacks[0]
    stack.split[2] = true
    stack.split[4] = true
    stack.split[6] = true
    const before = gameStore.game.stacks.length

    await gameStore.game.nextPhase()

    expect(gameStore.game.activePhase).toBe(MasterboardPhase.MOVE)
    expect(gameStore.game.stacks).toHaveLength(before + 1)
  })

  it("recomputes getters after an action changes state", async () => {
    const gameStore = useGameStore()
    gameStore.game.activePhase = MasterboardPhase.MOVE

    await gameStore.game.setRoll(4)

    expect(gameStore.game.activeRoll).toBe(4)
    expect(gameStore.mulliganAvailable).toBe(true)
  })
})

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

  // These exercise their own Pinia instance rather than the outer describe's shared one, since
  // they need to observe the very first hydration.
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
