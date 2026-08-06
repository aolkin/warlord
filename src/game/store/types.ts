export interface BaseActionContext {
  commit: (mutation: string, payload?: any, options?: object) => void
  dispatch: (action: string, payload?: any) => void
}
