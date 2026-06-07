export type PresetThemeId = 'fantasy' | 'cyberpunk' | 'western-world' | 'underwater-world'

export type GameTheme =
  | PresetThemeId
  | `custom-${string}`
  | `loading-${string}`

export const PRESET_THEME_IDS: PresetThemeId[] = [
  'fantasy',
  'cyberpunk',
  'western-world',
  'underwater-world',
]

export function isCustomTheme(theme: string): boolean {
  return theme.startsWith('custom-') || theme === 'custom'
}

export function isLoadingTheme(theme: string): boolean {
  return theme.startsWith('loading-')
}

export function isPresetTheme(theme: string): theme is PresetThemeId {
  return (PRESET_THEME_IDS as string[]).includes(theme)
}

export function getThemeId(theme: string | undefined | null): string {
  if (!theme || theme === 'custom') return 'fantasy'
  return theme
}
