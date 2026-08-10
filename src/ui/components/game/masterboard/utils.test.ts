import { describe, expect, it } from "vitest"
import masterboard from "@/models/masterboard"
import { hexCenter, hexTransform, localBearingToNeighbor, Point } from "./utils"

function rotate(deg: number, [x, y]: Point): Point {
  const rad = deg * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [x * cos - y * sin, x * sin + y * cos]
}

function bearingDeg([x, y]: Point): number {
  return Math.atan2(y, x) * 180 / Math.PI
}

function normalizeDelta(deg: number): number {
  const wrapped = deg % 360
  if (wrapped > 180) return wrapped - 360
  if (wrapped < -180) return wrapped + 360
  return wrapped
}

// Simulates the SVG nesting MasterboardStack.vue relies on for the engage icon: a child
// rotated locally and pushed out from the hex center, nested inside the hex's own
// hexTransform (rotate(sector) then translate(hexOffset)). Composed by hand here, independent
// of localBearingToNeighbor's own angle-addition math, so a sign or ordering bug there
// wouldn't also be baked into the check.
function place(hexId: number, localRotationDeg: number, localOffset: Point): Point {
  const [rotation, translation] = hexTransform(hexId)
  const [hexOffsetX, hexOffsetY] = translation.values as number[]
  const [rotatedX, rotatedY] = rotate(localRotationDeg, localOffset)
  return rotate(rotation.values[0] as number, [rotatedX + hexOffsetX, rotatedY + hexOffsetY])
}

describe("localBearingToNeighbor", () => {
  it("points toward every modeled neighbor's actual rendered position, for every hex", () => {
    for (const hexId of masterboard.getHexIds()) {
      for (const edge of masterboard.getHex(hexId).getEdges()) {
        const neighborId = edge.hex.id
        const trueBearing = bearingDeg([
          hexCenter(neighborId)[0] - hexCenter(hexId)[0],
          hexCenter(neighborId)[1] - hexCenter(hexId)[1]
        ])

        const placed = place(hexId, localBearingToNeighbor(hexId, neighborId), [0, 60])
        const placedBearing = bearingDeg([placed[0] - hexCenter(hexId)[0], placed[1] - hexCenter(hexId)[1]])

        expect(Math.abs(normalizeDelta(placedBearing - trueBearing)),
          `hex ${hexId} -> neighbor ${neighborId}`).toBeLessThan(0.01)
      }
    }
  })
})
