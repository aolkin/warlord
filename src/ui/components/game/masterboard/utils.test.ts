import { describe, expect, it } from "vitest"
import masterboard, { HexEdge } from "@/models/masterboard"
import { HEX_POINTS, hexTransform, isHexInverted } from "./utils"

type Point = [x: number, y: number]

// MasterboardStack.vue's getEngageTransformForEdge has the only call site for this formula, so
// it lives there inlined rather than as an export of utils.ts. Restated here (not imported) so
// this test is deriving its expected values independently rather than checking the formula
// against itself.
function engageIconRotation(hexId: number, edge: HexEdge): number {
  return edge * 120 + 60 + (isHexInverted(hexId) ? 0 : 180)
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

// A hex's local origin and its true visual center can differ (see hexCenter below), so this computes
// the actual centroid via the shoelace formula rather than assume they coincide.
function polygonCentroid(points: Point[]): Point {
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % points.length]
    const cross = x0 * y1 - x1 * y0
    area += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  area /= 2
  return [cx / (6 * area), cy / (6 * area)]
}

const HEX_LOCAL_CENTROID = polygonCentroid(
  HEX_POINTS.split(" ").map((pair): Point => {
    const [x, y] = pair.split(",").map(Number)
    return [x, y]
  })
)

// hexTransform/hexLocalOffset only position a hex's local-frame origin, not its visual center - this
// deliberately computes the latter. Centroid-to-centroid bearings, unlike origin-to-origin ones, are
// unaffected by HexShape.vue's per-hex inversion, which is why this check is independent.
function hexCenter(hexId: number): Point {
  const inverted = isHexInverted(hexId)
  const [localX, localY] = inverted ? [-HEX_LOCAL_CENTROID[0], -HEX_LOCAL_CENTROID[1]] : HEX_LOCAL_CENTROID
  const [rotation, translation] = hexTransform(hexId)
  const [offsetX, offsetY] = translation.values as number[]
  const [x, y] = [localX + offsetX, localY + offsetY]
  const rad = (rotation.values[0] as number) * Math.PI / 180
  return [x * Math.cos(rad) - y * Math.sin(rad), x * Math.sin(rad) + y * Math.cos(rad)]
}

describe("engageIconRotation", () => {
  it("points toward every modeled neighbor's true rendered center, for every hex", () => {
    for (const hexId of masterboard.getHexIds()) {
      const sectorRotation = masterboard.getHex(hexId).getSide() * -60
      for (const edge of masterboard.getHex(hexId).getEdges()) {
        const neighborId = edge.hex.id
        const trueBearing = bearingDeg([
          hexCenter(neighborId)[0] - hexCenter(hexId)[0],
          hexCenter(neighborId)[1] - hexCenter(hexId)[1]
        ])

        // engageIconRotation is a rotation applied in hexId's own local frame, before
        // hexTransform's sector rotation is layered on top; its own local offset ([0, d], for
        // any d) starts out pointing along local +y, i.e. a 90-degree bearing, before that
        // rotation is applied.
        const predictedBearing = sectorRotation + engageIconRotation(hexId, edge.hexEdge) + 90

        expect(Math.abs(normalizeDelta(predictedBearing - trueBearing)),
          `hex ${hexId} edge ${edge.hexEdge} -> neighbor ${neighborId}`).toBeLessThan(0.01)
      }
    }
  })
})
