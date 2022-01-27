import MASTERBOARD, { BoardArea } from "~/models/masterboard"

const TRIANGLE_HEIGHT_FACTOR = Math.sqrt(3) / 2
export const TRIANGLE_SIDE = 100
export const TRIANGLE_HEIGHT = TRIANGLE_SIDE * TRIANGLE_HEIGHT_FACTOR
export const CLIP_TRIANGLE_SIDE = 25
export const CLIP_TRIANGLE_HEIGHT = CLIP_TRIANGLE_SIDE * TRIANGLE_HEIGHT_FACTOR

export enum TransformationType {
  ROTATE,
  TRANSLATE,
  SCALE,
}

export class Transformation {
  readonly type: TransformationType;
  readonly values: Array<string|number>

  constructor(type: TransformationType, values: Array<string|number>) {
    this.type = type
    this.values = values
  }

  toString(): string {
    return `${TransformationType[this.type].toLowerCase()}(${this.values.join(" ")})`
  }
}

export class Transformations extends Array<Transformation> {
  toString(): string {
    return this.join(" ")
  }
}

export function hexTransform(hexId: number): Transformations {
  const hex = MASTERBOARD.hexes.get(hexId)
  if (hex === undefined) {
    throw new RangeError("Invalid hex")
  }
  const rotation = new Transformation(TransformationType.ROTATE, [hex.getSide() * -60])
  let x = 0
  let y = TRIANGLE_HEIGHT / 2
  switch (hex.getArea()) {
    case BoardArea.MIDDLE:
      if (hex.getSideIndex() < 2 || hex.getSideIndex() > 4) {
        const distFromCenter = hex.getSideIndex() - 3
        x = TRIANGLE_SIDE / 2 * (distFromCenter - (distFromCenter > 0 ? 1 : -1))
        y = TRIANGLE_HEIGHT * 2.5
      } else {
        x = (hex.getSideIndex() - 3) * TRIANGLE_SIDE / 2
        y = TRIANGLE_HEIGHT * 1.5
      }
      break
    case BoardArea.LOWER:
      x = TRIANGLE_SIDE / 2 * (hex.getSideIndex() - 3)
      y = TRIANGLE_HEIGHT * 3.5
      break
    case BoardArea.TOWER:
      y = TRIANGLE_HEIGHT * 2.5
      break
  }
  return new Transformations(rotation, new Transformation(TransformationType.TRANSLATE, [x, y]))
}

export function isHexInverted(hexId: number): boolean {
  const hex = MASTERBOARD.hexes.get(hexId)
  if (hex === undefined) {
    throw new RangeError("Invalid hex")
  }
  switch (hex.getArea()) {
    case BoardArea.MIDDLE:
      return hex.getSideIndex() % 2 === 1
    case BoardArea.LOWER:
      return hex.id % 2 !== hex.getSide() % 2
    default:
      return false
  }
}
