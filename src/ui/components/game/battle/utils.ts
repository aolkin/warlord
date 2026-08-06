import { div, mod } from "~/utils/math"
import { Transformation, Transformations, TransformationType } from "~/utils/svg"

export const hexTransform = (hex: number): Transformations => {
  const row = div(hex, 6) - 3
  const offset = mod(row, 2) * -58
  const column = mod(hex, 6) - 3
  const translation = new Transformation(TransformationType.TRANSLATE,
    [offset + column * 116, row * 100])
  return new Transformations(translation)
}

export const hexTransformStr = (hex: number): string => {
  return hexTransform(hex).toString()
}
