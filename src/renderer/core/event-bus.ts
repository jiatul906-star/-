type Listener = (...args: any[]) => void

class EventBus {
  private listeners: Map<string, Set<Listener>> = new Map()

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
    return () => this.off(event, listener)
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener)
  }

  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((fn) => fn(...args))
  }
}

export const eventBus = new EventBus()
