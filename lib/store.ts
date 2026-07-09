import { create } from 'zustand'
import { GameTheme, getThemeId, isCustomTheme, resolveValidTheme } from '@/lib/theme-utils'

export type { GameTheme } from '@/lib/theme-utils'
export type GameState = 'menu' | 'loading' | 'playing'
export type CharacterType = 'player' | 'enemy' | 'npc'
export type LevelType = 'ground' | 'underground' | 'sky'

interface LevelData {
  id: string
  backgroundUrl: string
  groundUrl?: string
  obstacleUrl?: string
  obstacles: Obstacle[]
}

interface GameData {
  success?: boolean
  data?: {
    characterUrl: string
    levels: LevelData[]
  }
  generationId?: string
  timestamp?: string
}

interface ProcessedImages {
  [themeId: string]: {
    character?: string
    background?: string
    ground?: string
    obstacle?: string
  }
}

interface Obstacle {
  id: string
  x: number
  y: number
  width: number
  height: number
  type: string
}

interface GroundTile {
  id: string
  x: number
  y: number
  width: number
  height: number
}

interface GameStore {
  // 游戏状态
  gameState: GameState
  setGameState: (state: GameState) => void

  // 主题相关
  selectedTheme: GameTheme
  customPrompt: string
  setSelectedTheme: (theme: GameTheme) => void
  setCustomPrompt: (prompt: string) => void

  // 生成参数
  characterType: CharacterType
  levelType: LevelType
  setCharacterType: (type: CharacterType) => void
  setLevelType: (type: LevelType) => void

  // 当前动作
  currentAction: string
  setCurrentAction: (action: string) => void

  // 游戏数据（当前选中主题）
  gameData: GameData
  gameDataByTheme: Record<string, GameData>
  setGameData: (data: GameData, themeId?: string) => void
  getGameDataForTheme: (themeId: string) => GameData
  removeGameDataForTheme: (themeId: string) => void

  // 多关卡相关
  currentLevelIndex: number
  totalLevels: number
  levelCount: number
  setCurrentLevelIndex: (index: number) => void
  setTotalLevels: (count: number) => void
  setLevelCount: (count: number) => void
  getCurrentLevel: () => LevelData | null
  nextLevel: () => boolean
  isLastLevel: () => boolean

  // 抠图结果
  processedImages: ProcessedImages
  setProcessedImages: (images: ProcessedImages) => void
  updateProcessedImage: (themeId: string, type: 'character' | 'background' | 'ground' | 'obstacle', url: string) => void
  getProcessedImagesForTheme: (themeId: string) => { character?: string; background?: string; ground?: string; obstacle?: string }
  removeProcessedImagesForTheme: (themeId: string) => void

  // 加载状态
  isLoading: boolean
  loadingProgress: number
  loadingMessage: string
  setLoading: (loading: boolean) => void
  setLoadingProgress: (progress: number) => void
  setLoadingMessage: (message: string) => void

  // 玩家位置
  playerPosition: { x: number; y: number }
  setPlayerPosition: (position: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void

  // 地面系统
  groundTiles: GroundTile[]
  groundHeight: number
  setGroundTiles: (tiles: GroundTile[]) => void
  setGroundHeight: (height: number) => void

  // 障碍物系统
  obstacles: Obstacle[]
  setObstacles: (obstacles: Obstacle[]) => void
  addObstacle: (obstacle: Obstacle) => void
  removeObstacle: (id: string) => void

  // 碰撞检测
  isCollisionEnabled: boolean
  setCollisionEnabled: (enabled: boolean) => void

  // 持久化
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void

  // 重置函数
  resetGame: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  // 初始状态
  gameState: 'menu',
  selectedTheme: 'fantasy',
  customPrompt: '',
  characterType: 'player',
  levelType: 'ground',
  currentAction: 'idle',
  gameData: {},
  gameDataByTheme: {},
  currentLevelIndex: 0,
  totalLevels: 1,
  levelCount: 1,
  processedImages: {},
  isLoading: false,
  loadingProgress: 0,
  loadingMessage: '',
  playerPosition: { x: 100, y: 400 },
  groundTiles: [],
  groundHeight: 350,
  obstacles: [],
  isCollisionEnabled: true,

  // 状态更新函数
  setGameState: (state) => set({ gameState: state }),
  setSelectedTheme: (theme) => {
    const state = get()
    const themeData = state.gameDataByTheme[theme] || {}
    const totalLevels = themeData.data?.levels?.length || 1
    set({
      selectedTheme: theme,
      gameData: themeData,
      totalLevels,
      currentLevelIndex: 0,
    })
    get().saveToLocalStorage()
  },
  setCustomPrompt: (prompt) => set({ customPrompt: prompt }),
  setCharacterType: (type) => set({ characterType: type }),
  setLevelType: (type) => set({ levelType: type }),
  setCurrentAction: (action) => set({ currentAction: action }),
  setGameData: (data, themeId) => {
    const state = get()
    const currentThemeId = getThemeId(themeId || state.selectedTheme)

    const updatedGameDataByTheme = {
      ...state.gameDataByTheme,
      [currentThemeId]: data,
    }

    const updates: Partial<GameStore> = {
      gameDataByTheme: updatedGameDataByTheme,
    }

    if (data?.data) {
      const updatedProcessedImages = { ...state.processedImages }

      if (updatedProcessedImages[currentThemeId]) {
        const themeImages = { ...updatedProcessedImages[currentThemeId] }

        if (data.data.characterUrl) delete themeImages.character
        if (data.data.levels) {
          delete themeImages.background
          delete themeImages.ground
          delete themeImages.obstacle
        }

        updatedProcessedImages[currentThemeId] = themeImages
      }

      updates.processedImages = updatedProcessedImages

      if (currentThemeId === state.selectedTheme) {
        const totalLevels = data.data.levels?.length || 1
        updates.gameData = data
        updates.totalLevels = totalLevels

        if (state.currentLevelIndex >= totalLevels) {
          updates.currentLevelIndex = 0
        }
      }
    } else if (currentThemeId === state.selectedTheme) {
      updates.gameData = data
    }

    set(updates)
    get().saveToLocalStorage()
  },

  getGameDataForTheme: (themeId) => {
    return get().gameDataByTheme[getThemeId(themeId)] || {}
  },

  removeGameDataForTheme: (themeId) => {
    const tid = getThemeId(themeId)
    const state = get()
    const { [tid]: _, ...rest } = state.gameDataByTheme
    const updates: Partial<GameStore> = { gameDataByTheme: rest }

    if (state.selectedTheme === tid) {
      updates.gameData = {}
      updates.totalLevels = 1
      updates.currentLevelIndex = 0
    }

    set(updates)
    get().saveToLocalStorage()
  },

  // 多关卡相关方法
  setCurrentLevelIndex: (index) => set({ currentLevelIndex: index }),
  setTotalLevels: (count) => set({ totalLevels: count }),
  setLevelCount: (count) => set({ levelCount: count }),
  getCurrentLevel: () => {
    const state = get()
    const levels = state.gameData.data?.levels
    if (!levels || levels.length === 0) return null
    return levels[state.currentLevelIndex] || null
  },
  nextLevel: () => {
    const state = get()
    const nextIndex = state.currentLevelIndex + 1
    if (nextIndex < state.totalLevels) {
      set({ currentLevelIndex: nextIndex })
      return true
    }
    return false
  },
  isLastLevel: () => {
    const state = get()
    return state.currentLevelIndex >= state.totalLevels - 1
  },
  setProcessedImages: (images) => {
    set({ processedImages: images })
    get().saveToLocalStorage()
  },
  updateProcessedImage: (themeId, type, url) => {
    set((state) => ({
      processedImages: {
        ...state.processedImages,
        [themeId]: {
          ...state.processedImages[themeId],
          [type]: url,
        },
      },
    }))
    get().saveToLocalStorage()
  },
  getProcessedImagesForTheme: (themeId) => {
    const state = get()
    return state.processedImages[themeId] || {}
  },
  removeProcessedImagesForTheme: (themeId) => {
    const tid = getThemeId(themeId)
    const state = get()
    const { [tid]: _, ...rest } = state.processedImages
    set({ processedImages: rest })
    get().saveToLocalStorage()
  },
  setLoading: (loading) => set({ isLoading: loading }),
  setLoadingProgress: (progress) => set({ loadingProgress: progress }),
  setLoadingMessage: (message) => set({ loadingMessage: message }),
  setPlayerPosition: (position) => set((state) => ({
    playerPosition: typeof position === 'function' ? position(state.playerPosition) : position,
  })),
  setGroundTiles: (tiles) => set({ groundTiles: tiles }),
  setGroundHeight: (height) => set({ groundHeight: height }),
  setObstacles: (obstacles) => set({ obstacles }),
  addObstacle: (obstacle) => set((state) => ({ obstacles: [...state.obstacles, obstacle] })),
  removeObstacle: (id) => set((state) => ({ obstacles: state.obstacles.filter((o) => o.id !== id) })),
  setCollisionEnabled: (enabled) => set({ isCollisionEnabled: enabled }),

  // 持久化方法
  saveToLocalStorage: () => {
    const state = get()
    const dataToSave = {
      gameData: state.gameData,
      gameDataByTheme: state.gameDataByTheme,
      processedImages: state.processedImages,
      selectedTheme: state.selectedTheme,
      customPrompt: state.customPrompt,
    }
    localStorage.setItem('pixel-seed-game-data', JSON.stringify(dataToSave))
  },

  loadFromLocalStorage: () => {
    try {
      const saved = localStorage.getItem('pixel-seed-game-data')
      if (saved) {
        const data = JSON.parse(saved)
        const rawTheme = data.selectedTheme || 'fantasy'
        const gameDataByTheme = data.gameDataByTheme || {}

        // 迁移旧版单份 gameData 到按主题存储
        if (data.gameData?.data && Object.keys(gameDataByTheme).length === 0) {
          const legacyThemeId = getThemeId(rawTheme)
          gameDataByTheme[legacyThemeId] = data.gameData
        }

        let selectedTheme = resolveValidTheme(rawTheme)
        if (isCustomTheme(selectedTheme) && !gameDataByTheme[selectedTheme]?.data) {
          selectedTheme = 'fantasy'
        }

        const themeData = gameDataByTheme[selectedTheme] || data.gameData || {}
        const totalLevels = themeData.data?.levels?.length || 1

        set({
          gameData: themeData,
          gameDataByTheme,
          processedImages: data.processedImages || {},
          selectedTheme,
          customPrompt: data.customPrompt || '',
          totalLevels,
        })
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
    }
  },

  // 重置游戏（保留抠图结果）
  resetGame: () => {
    const currentState = get()
    set({
      gameState: 'menu',
      selectedTheme: currentState.selectedTheme,
      customPrompt: currentState.customPrompt,
      characterType: 'player',
      levelType: 'ground',
      currentAction: 'idle',
      gameData: currentState.gameData,
      gameDataByTheme: currentState.gameDataByTheme,
      currentLevelIndex: 0,
      totalLevels: currentState.totalLevels,
      levelCount: currentState.levelCount,
      processedImages: currentState.processedImages,
      isLoading: false,
      loadingProgress: 0,
      loadingMessage: '',
      playerPosition: { x: 100, y: 400 },
      groundTiles: [],
      groundHeight: 350,
      obstacles: [],
      isCollisionEnabled: true,
    })
    get().saveToLocalStorage()
  },
}))
