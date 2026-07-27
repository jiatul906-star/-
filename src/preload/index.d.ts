import type { PetAction, CharactersData, ApiProfilesData, ApiProfile, ChatMessage, MemoryEntry, TtsSettings, GpuInfo, ModelDownloadProgress, PipInstallProgress } from '../common/types'

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
      getPetActions: (charName: string) => Promise<PetAction[]>
      savePetActions: (charName: string, actions: PetAction[]) => Promise<void>
      onPetActionsUpdated: (callback: (payload: { charName: string; actions: PetAction[] }) => void) => () => void
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
      // ===== 视频分析 & 转码 =====
      analyzeVideo: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>
      transcodeVideo: (inputPath: string, charName: string, outputName?: string) => Promise<{ success: boolean; outputPath: string; error?: string }>
      checkFfmpeg: () => Promise<{ available: boolean; path: string | null }>
      onVideoTranscodeProgress: (callback: (progress: { percent: number; stage: 'analyzing' | 'transcoding' | 'done' | 'error'; speed?: string; error?: string }) => void) => () => void
      // ===== TTS =====
      synthesizeTTS: (charName: string, text: string) => Promise<string | null>
      checkTtsHealth: () => Promise<boolean>
      getTtsStatus: () => Promise<{ status: string; port: number }>
      getGpuInfo: () => Promise<GpuInfo>
      getTtsSettings: () => Promise<TtsSettings>
      saveTtsSettings: (settings: TtsSettings) => Promise<void>
      onTtsSettingsUpdated: (callback: (settings: TtsSettings) => void) => () => void
      saveReferenceAudio: (charName: string) => Promise<string | null>
      getReferenceAudio: (charName: string) => Promise<string | null>
      downloadModel: () => Promise<boolean>
      getModelStatus: () => Promise<{ ready: boolean; dir: string }>
      onModelDownloadProgress: (callback: (progress: ModelDownloadProgress) => void) => () => void
      // Python 环境
      checkPythonEnv: () => Promise<{ status: string; pythonPath: string; pythonVersion: string; pipVersion: string; error?: string }>
      installDeps: () => Promise<boolean>
      onPipInstallProgress: (callback: (progress: PipInstallProgress) => void) => () => void
    }
  }
}

export {}
