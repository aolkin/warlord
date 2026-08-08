import { describe, expect, it } from "vitest"
import masterboard, { BoardArea, MovementRule, Terrain } from "./masterboard"

// The Masterboard "is a network of 96 spaces representing the Lands of TITAN.
// These Lands are divided among 11 different types of terrain" (rulebook 2.1).
const TOTAL_HEXES = 96
const TERRAIN_TYPES = 11

describe("Masterboard hex graph structure", () => {
  it("contains all 96 Lands described by the rulebook (2.1)", () => {
    expect(masterboard.getHexIds()).toHaveLength(TOTAL_HEXES)
  })

  it("records every edge symmetrically, so each neighbour also references the hex back", () => {
    for (const id of masterboard.getHexIds()) {
      const hex = masterboard.getHex(id)
      for (const edge of hex.getEdges()) {
        const backReference = edge.hex.getEdges().find(candidate => candidate.hex.id === id)
        expect(backReference, `hex ${edge.hex.id} has no edge back to hex ${id}`).toBeDefined()
      }
    }
  })

  it("is fully connected: every Land is reachable from every other Land", () => {
    const [start, ...rest] = masterboard.getHexIds()
    const visited = new Set([start])
    const queue = [start]
    while (queue.length > 0) {
      const hex = masterboard.getHex(queue.pop()!)
      for (const edge of hex.getEdges()) {
        if (!visited.has(edge.hex.id)) {
          visited.add(edge.hex.id)
          queue.push(edge.hex.id)
        }
      }
    }
    expect(rest.every(id => visited.has(id))).toBe(true)
  })

  // Legions move around the board along Arrows; following the single forward
  // Arrow out of each non-Tower Land should trace a closed loop through every
  // Land of that ring before returning to the start, with no detours or dead ends.
  it.each([
    { label: "middle ring", startId: 1, area: BoardArea.MIDDLE, size: 42 },
    { label: "lower ring", startId: 101, area: BoardArea.LOWER, size: 42 },
    { label: "upper ring", startId: 1000, area: BoardArea.UPPER, size: 6 }
  ])("the $label forms a single closed loop covering every one of its $size Lands", ({ startId, area, size }) => {
    const visited: number[] = []
    let currentId = startId
    for (let step = 0; step < size; step++) {
      visited.push(currentId)
      const hex = masterboard.getHex(currentId)
      const forward = hex.getEdges().find(edge =>
        edge.rule === MovementRule.ARROW && edge.hex.getArea() === area)
      expect(forward, `hex ${currentId} has no forward Arrow within its ring`).toBeDefined()
      currentId = forward!.hex.id
    }
    expect(new Set(visited).size).toBe(size)
    expect(currentId).toBe(startId)
  })
})

describe("Masterboard terrain assignment", () => {
  it("uses all 11 terrain types described by the rulebook (2.1)", () => {
    const usedTerrains = new Set(masterboard.getHexIds().map(id => masterboard.getHex(id).terrain))
    expect(usedTerrains.size).toBe(TERRAIN_TYPES)
  })

  it("assigns TOWER terrain to exactly the 6 Tower Lands and nothing else", () => {
    const towerHexes = masterboard.getHexIds().filter(id => masterboard.getHex(id).terrain === Terrain.TOWER)
    expect(towerHexes.sort((a, b) => a - b)).toEqual([100, 200, 300, 400, 500, 600])
    expect(towerHexes.every(id => masterboard.getHex(id).getArea() === BoardArea.TOWER)).toBe(true)
  })
})

describe("Masterboard entry sides", () => {
  // "A Legion standing on a Tower Land may begin its next move in the direction
  // of any of that Tower's Arrows" (rulebook 7.4, Arrow, a).
  it("gives each Tower Land exactly 3 Arrow exits", () => {
    for (const towerId of [100, 200, 300, 400, 500, 600]) {
      const edges = masterboard.getHex(towerId).getEdges()
      expect(edges).toHaveLength(3)
      expect(edges.every(edge => edge.rule === MovementRule.ARROW)).toBe(true)
    }
  })

  it("connects each Tower Land into both the middle and lower rings", () => {
    for (const towerId of [100, 200, 300, 400, 500, 600]) {
      const areas = masterboard.getHex(towerId).getEdges().map(edge => edge.hex.getArea())
      expect(areas.filter(area => area === BoardArea.MIDDLE)).toHaveLength(2)
      expect(areas.filter(area => area === BoardArea.LOWER)).toHaveLength(1)
    }
  })
})
