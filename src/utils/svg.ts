export enum TransformationType {
  ROTATE,
  TRANSLATE,
  SCALE,
}

export class Transformation {
  readonly type: TransformationType;
  readonly values: Array<string | number>

  constructor(type: TransformationType, values: Array<string | number>) {
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

export type Point = [x: number, y: number]

// Applies an SVG transform list to a point, in the same order the SVG spec composes them:
// the last transform in the list is applied to the point first (innermost), the first last
// (outermost). Used to derive real screen-space positions/angles for placement math that
// can't just hand a string to the DOM (e.g. picking a rotation before anything is rendered).
export function applyTransforms(transforms: Transformations, [x, y]: Point): Point {
  for (let i = transforms.length - 1; i >= 0; i--) {
    const { type, values } = transforms[i]
    switch (type) {
      case TransformationType.TRANSLATE: {
        const [tx, ty] = values as number[]
        x += tx
        y += ty
        break
      }
      case TransformationType.SCALE: {
        const [s] = values as number[]
        x *= s
        y *= s
        break
      }
      case TransformationType.ROTATE: {
        const [deg] = values as number[]
        const rad = deg * Math.PI / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        const [px, py] = [x, y]
        x = px * cos - py * sin
        y = px * sin + py * cos
        break
      }
    }
  }
  return [x, y]
}
