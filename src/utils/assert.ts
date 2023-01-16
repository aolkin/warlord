import * as assertBuiltin from "assert"

export function assert(condition: boolean, msg: string): asserts condition {
  if (typeof assertBuiltin === "function") {
    assertBuiltin(condition, msg)
  } else {
    console.assert(condition, msg)
  }
}
