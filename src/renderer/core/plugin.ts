// 插件接口定义 — 所有插件必须实现此接口

export interface Plugin {
  id: string
  name: string
  mount: (container: HTMLElement) => void
  unmount: () => void
}
