import { describe, expect, it } from "vitest"
import masterboard from "@/models/masterboard"
import { applyTransforms, Transformation, Transformations, TransformationType } from "~/utils/svg"
import { hexCenter, hexTransform, localBearingToNeighbor } from "./utils"

function bearingDeg([x, y]: [number, number]): number {
  return Math.atan2(y, x) * 180 / Math.PI
}

function normalizeDelta(deg: number): number {
  const wrapped = deg % 360
  if (wrapped > 180) return wrapped - 360
  if (wrapped < -180) return wrapped + 360
  return wrapped
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

        // Place a point using only the rotation under test plus a fixed-distance translate,
        // composed with the hex's own hexTransform - mirroring how MasterboardStack.vue
        // nests an edge-facing child inside a hex's transform - and check it lands in the
        // true neighbor's direction rather than, say, the opposite side of the hex.
        const placed = applyTransforms(new Transformations(
          ...hexTransform(hexId),
          new Transformation(TransformationType.ROTATE, [localBearingToNeighbor(hexId, neighborId)]),
          new Transformation(TransformationType.TRANSLATE, [0, 60])
        ), [0, 0])
        const placedBearing = bearingDeg([placed[0] - hexCenter(hexId)[0], placed[1] - hexCenter(hexId)[1]])

        expect(Math.abs(normalizeDelta(placedBearing - trueBearing)),
          `hex ${hexId} -> neighbor ${neighborId}`).toBeLessThan(0.01)
      }
    }
  })
})
