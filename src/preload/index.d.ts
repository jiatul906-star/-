import type { PetAction, CharactersData, ApiProfilesData, ApiProfile, ChatMessage, MemoryEntry } from '../common/types'

declare global {
  interface Window {
    electronAPI: {
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      quit: () => Promise<void>
      togglePetPassthrough: () => Promise<boolean>
      movePet: (dx: number, dy: number) => Promise<void>
      resizePet: (expand: boolean, charWinX: number, charWinY: number) => Promise<void>
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
      onPetMenuClose: (callback: () => void) => () => void
      // API Profiles
      getApiProfiles: () => Promise<ApiProfilesData>
      saveApiProfiles: (data: ApiProfilesData) => Promise<void>
      testApiConnection: (profile: ApiProfile) => Promise<{ ok: boolean; status: number; error?: string }>
      onApiProfilesUpdated: (callback: (data: ApiProfilesData) => void) => () => void
      // Chat History
      getChatHistory: (characterId: string) => Promise<ChatMessage[]>
      addChatMessage: (characterId: string, message: ChatMessage) => Promise<void>
      clearChatHistory: (characterId: string) => Promise<void>
      // Agent Memory
      getAgentMemory: (characterId: string) => Promise<MemoryEntry[]>
      addAgentMemory: (characterId: string, entry: MemoryEntry) => Promise<void>
      deleteAgentMemory: (characterId: string, id: string) => Promise<void>
      updateAgentMemory: (characterId: string, id: string, content: string) => Promise<void>
    }
  }
}

export {}
