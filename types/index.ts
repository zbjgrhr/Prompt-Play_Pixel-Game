import { ReactNode } from 'react'
import { GameTheme } from '@/lib/theme-utils'

// 主题相关类型
export interface Theme {
  id: GameTheme
  name: string
  description: string
  characterImage: string
  backgroundImage: string
  groundImage: string
  obstacleImage: string
  isLoading?: boolean
}

// 关卡数据类型
export interface LevelData {
  id: string
  backgroundUrl: string
  groundUrl?: string
  obstacleUrl?: string
  obstacles: Array<{
    id: string
    x: number
    y: number
    width: number
    height: number
    type: string
  }>
}

// 游戏数据类型
export interface GameData {
  success?: boolean
  data?: {
    characterUrl: string
    levels: LevelData[]
  }
  generationId?: string
  timestamp?: string
}

// 项目头部组件Props
export interface ProjectHeaderProps {
  className?: string
}

// 模型选择器组件Props
export interface ModelSelectorProps {
  selectedModel: string
  onModelChange: (model: string) => void
  apiKey: string
  onApiKeyChange: (apiKey: string) => void
}

// 主题定制器组件Props
export interface ThemeCustomizerProps {
  customThemeName: string
  onThemeNameChange: (name: string) => void
  customPrompt: string
  onPromptChange: (prompt: string) => void
  levelCount?: number
  onLevelCountChange?: (count: number) => void
}

// 操作按钮组件Props
export interface ActionButtonsProps {
  isThemeCreated: boolean
  isLoading: boolean
  selectedTheme: string
  customPrompt: string
  customThemeName: string
  apiKey: string
  onCreateTheme: () => void
  onStartGame: () => void
}

// 主题列表组件Props
export interface ThemesListProps {
  themes: Theme[]
  selectedTheme: GameTheme
  onThemeSelect: (themeId: GameTheme) => void
}

// 主题预览组件Props
export interface ThemePreviewProps {
  isLoading: boolean
  loadingMessage?: string
  gameData?: GameData
  selectedTheme: GameTheme
  themes: Theme[]
  regeneratingImages?: {
    character: boolean;
    background: boolean;
    ground: boolean;
    obstacle: boolean;
  }
  apiKey?: string
  onRegenerateImage?: (themeId: string, imageType: 'character' | 'background' | 'ground' | 'obstacle', apiKey: string) => Promise<void>
  onDeleteTheme?: (themeId: string) => void
}



// 游戏画布组件Props
export interface GameCanvasProps {
  loadingProgress?: number
  loadingMessage?: string
  onBackToMenu?: () => void
}

// 主菜单组件Props
export interface MenuProps {
  className?: string
}

// 主题选择处理函数类型
export type ThemeSelectHandler = (themeId: GameTheme) => void

// 主题创建处理函数类型
export type ThemeCreateHandler = () => Promise<void>

// 游戏开始处理函数类型
export type GameStartHandler = () => void