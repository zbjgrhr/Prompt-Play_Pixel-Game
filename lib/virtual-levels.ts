import { PRESET_THEMES } from '@/configs'
import { getThemeId } from '@/lib/theme-utils'

interface ThemeAssets {
  characterUrl: string
  backgroundUrl: string
  groundUrl: string
  obstacleUrl: string
}

interface LevelData {
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

interface GameData {
  success?: boolean
  data?: {
    characterUrl: string
    levels: LevelData[]
  }
  generationId?: string
  timestamp?: string
}

const DEFAULT_VIRTUAL_LEVEL_COUNT = 3

export function resolveThemeAssets(selectedTheme: string): ThemeAssets | null {
  let theme = PRESET_THEMES.find((t) => t.id === selectedTheme)

  try {
    const savedThemes = localStorage.getItem('pixel-seed-themes')
    if (savedThemes) {
      const themes = JSON.parse(savedThemes)
      const updated = themes.find((t: { id: string }) => t.id === selectedTheme)
      if (updated) theme = updated
    }
  } catch {
    // ignore
  }

  if (!theme) return null

  return {
    characterUrl: theme.characterImage || '',
    backgroundUrl: theme.backgroundImage || '',
    groundUrl: theme.groundImage || '',
    obstacleUrl: theme.obstacleImage || '',
  }
}

export function buildVirtualGameData(
  assets: ThemeAssets,
  levelCount: number,
  themeId: string,
): GameData {
  const count = Math.max(2, Math.min(10, levelCount))
  const levels: LevelData[] = Array.from({ length: count }, (_, i) => ({
    id: `virtual-level-${i + 1}`,
    backgroundUrl: assets.backgroundUrl,
    groundUrl: assets.groundUrl,
    obstacleUrl: assets.obstacleUrl,
    obstacles: [],
  }))

  return {
    success: true,
    data: {
      characterUrl: assets.characterUrl,
      levels,
    },
    generationId: `virtual-${getThemeId(themeId)}-${Date.now()}`,
    timestamp: new Date().toISOString(),
  }
}

export function ensurePlayableLevels(
  selectedTheme: string,
  levelCount: number,
  gameData: GameData,
): GameData {
  const existingLevels = gameData?.data?.levels
  if (existingLevels && existingLevels.length >= 2) {
    return gameData
  }

  const assets = resolveThemeAssets(selectedTheme)
  if (!assets?.backgroundUrl) {
    return gameData
  }

  const count =
    existingLevels && existingLevels.length === 1
      ? Math.max(levelCount, DEFAULT_VIRTUAL_LEVEL_COUNT)
      : levelCount >= 2
        ? levelCount
        : DEFAULT_VIRTUAL_LEVEL_COUNT

  return buildVirtualGameData(assets, count, selectedTheme)
}

export function syncPlayableLevels(
  selectedTheme: string,
  levelCount: number,
  gameData: GameData,
): { gameData: GameData; totalLevels: number } {
  const synced = ensurePlayableLevels(selectedTheme, levelCount, gameData)
  const totalLevels = synced.data?.levels?.length || 1
  return { gameData: synced, totalLevels }
}
