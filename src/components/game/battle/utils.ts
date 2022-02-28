import { div, mod } from "~/utils/math"
import { Transformation, Transformations, TransformationType } from "~/utils/svg"

export const hexTransform = (hex: number, index?: number): Transformations => {
  if (hex < 36) {
    const row = div(hex, 6) - 3
    const offset = mod(row, 2) * -58
    const column = mod(hex, 6) - 3
    const translation = new Transformation(TransformationType.TRANSLATE,
      [offset + column * 116, row * 100])
    return new Transformations(translation)
  } else { // Initial hex, shift by index as well
    if (mod(hex, 2) === 0) { // Defender
      return new Transformations()
    } else { // Attacker
      return new Transformations()
    }
  }
}

export const hexTransformStr = (hex: number, index?: number): string => {
  return hexTransform(hex, index).toString()
}
