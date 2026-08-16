import { describe, expect, it } from "vitest"
import { Terrain } from "../masterboard"
import {
  BATTLE_BOARD_ADJACENCIES,
  BATTLE_BOARDS,
  EdgeHazard,
  Hazard,
  getAdjacentHexForRelation,
  relationToHex,
} from "./board"

describe("BattleBoard accessors", () => {
  it("falls back to no elevation, no hazard, and no edge hazard for a board with no data", () => {
    const board = BATTLE_BOARDS[Terrain.PLAINS] // Plains has no elevations, hazards, or edge hazards at all
    expect(board.getElevation(8)).toBe(0)
    expect(board.getHazard(8)).toBe(Hazard.NONE)
    expect(board.getEdgeHazard(2, 8)).toBe(EdgeHazard.NONE)
    expect(board.getEdgeHazards(8)).toEqual({})
  })

  it("looks up an edge hazard only in the stored (lower, upper) direction", () => {
    // Terrain.HILLS' battle board stores the slope from hex 3 (elevation 0) up to hex 2
    // (elevation 1) as edgeHazards[2][3] - i.e. keyed by upper hex, then lower hex.
    const board = BATTLE_BOARDS[Terrain.HILLS]
    expect(board.getEdgeHazard(3, 2)).toBe(EdgeHazard.SLOPE) // (lower, upper) matches storage
    expect(board.getEdgeHazard(2, 3)).toBe(EdgeHazard.NONE) // reversed order finds nothing
  })
})

describe("Hex adjacency (relationToHex / getAdjacentHexForRelation)", () => {
  it("are mutual inverses for every neighbor of an interior hex", () => {
    // Hex 15 sits in the middle of its row with all six neighbors present on the board.
    const neighbors = BATTLE_BOARD_ADJACENCIES[15]
    expect(neighbors).toHaveLength(6)
    neighbors.forEach(neighbor => {
      const relation = relationToHex(15, neighbor)
      expect(getAdjacentHexForRelation(15, relation)).toBe(neighbor)
    })
  })

  it("excludes the seam between the ends of two rows even though the raw distance arithmetic would land there", () => {
    // Hex 17 is the rightmost hex of its row (13-17); hex 18 is the leftmost hex of the next,
    // wider row (18-23). They are not spatially adjacent, but getAdjacencyDists' even/odd-row
    // distance table would otherwise place hex 18 one step from hex 17 (17 + 1) purely from the
    // row-numbering gap - board.ts hardcodes that one direction on each hex to a distance of 99
    // to suppress the false adjacency.
    expect(BATTLE_BOARD_ADJACENCIES[17]).not.toContain(18)
    expect(BATTLE_BOARD_ADJACENCIES[18]).not.toContain(17)
    expect(relationToHex(17, 18)).toBe(-1) // not found among hex 17's real adjacency distances
  })
})
