import type { PetAction, CharactersData } from '../common/types'

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
      getCharacters: () => Promise<CharactersData>
      saveCharacters: (data: CharactersData) => Promise<void>
      onCharactersUpdated: (callback: (data: CharactersData) => void) => () => void
      openImageDialog: (charId: string) => Promise<string | null>
      getPetImage: (charId: string) => Promise<string | null>
      onPetImageUpdated: (callback: (payload: { charId: string; dataUrl: string | null }) => void) => () => void
    }
  }
}

export {}
