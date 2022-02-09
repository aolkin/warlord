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
