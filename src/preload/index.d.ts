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
      onPetActionsUpdated: (callback: (actions: PetAction[]) => void) => () => void
      openChat: () => Promise<void>
      openSettings: () => Promise<void>
      openVideoDialog: (charName: string) => Promise<string | null>
      openIdleVideosFolder: () => Promise<void>
      getVideoPath: (charName: string, videoFileName: string) => Promise<string | null>
      openCharacterVideoFolder: (charName: string) => Promise<void>
      listIdleVideos: (charName: string) => Promise<string[]>
      getCharacters: () => Promise<CharactersData>
      saveCharacters: (data: CharactersData) => Promise<void>
      onCharactersUpdated: (callback: (data: CharactersData) => void) => () => void
      openImageDialog: (charName: string, imageType: string) => Promise<string | null>
      getPetImage: (charName: string, imageType: string) => Promise<string | null>
      onPetImageUpdated: (callback: (payload: { charId: string; charName: string; imageType: string; dataUrl: string | null }) => void) => () => void
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
      onChatHistoryUpdated: (callback: (payload: { characterId: string; message?: ChatMessage; cleared?: boolean }) => void) => () => void
      // Agent Memory
      getAgentMemory: (characterId: string) => Promise<MemoryEntry[]>
      addAgentMemory: (characterId: string, entry: MemoryEntry) => Promise<void>
      deleteAgentMemory: (characterId: string, id: string) => Promise<void>
      updateAgentMemory: (characterId: string, id: string, content: string) => Promise<void>
      exportAgentMemory: (characterId: string, charName: string) => Promise<{ success: boolean; error?: string }>
      importAgentMemory: (characterId: string) => Promise<{ success: boolean; entries?: MemoryEntry[]; error?: string; reason?: string }>
    }
  }
}

export {}
