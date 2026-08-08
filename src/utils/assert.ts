export function assert(condition: boolean, msg: string): asserts condition {
  if (condition) return
  if (import.meta.env.DEV) {
    throw new Error(msg)
  }
  console.assert(condition, msg)
}
