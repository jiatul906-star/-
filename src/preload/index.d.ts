import type { PetAction } from '../common/types'

declare global {
  interface Window {
    electronAPI: {
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      quit: () => Promise<void>
      togglePetPassthrough: () => Promise<boolean>
      movePet: (dx: number, dy: number) => Promise<void>
      getPetActions: () => Promise<PetAction[]>
      savePetActions: (actions: PetAction[]) => Promise<void>
      openChat: () => Promise<void>
      openSettings: () => Promise<void>
      openVideoDialog: () => Promise<string | null>
    }
  }
}

export {}
