import { describe, it, expect } from "vitest"
import { Stack } from "./stack"
import { CreatureType } from "./creature"
import { PlayerId } from "./player"

describe("Stack", () => {
  it("initializes with default creatures", () => {
    const stack = new Stack(PlayerId.RED, 5, 0)
    expect(stack.creatures.length).toBe(8)
    expect(stack.creatures[0]).toBe(CreatureType.TITAN)
  })

  it("starts with origin equal to hex", () => {
    const stack = new Stack(PlayerId.BLUE, 10, 0)
    expect(stack.origin).toBe(10)
    expect(stack.hex).toBe(10)
    expect(stack.hasMoved()).toBe(false)
  })

  it("detects movement", () => {
    const stack = new Stack(PlayerId.RED, 5, 0)
    stack.hex = 6
    expect(stack.hasMoved()).toBe(true)
  })
})
