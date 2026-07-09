'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Splitter, message } from 'antd'
import { useGameStore } from '@/lib/store'
import { GameTheme, isCustomTheme } from '@/lib/theme-utils'
import {
  GameCanvas,
  SideMenu,
  ThemesList,
  ThemePreview,
} from '@/components/ui'
import { PRESET_THEMES } from '@/configs'
import { getDefaultModel, getDefaultProvider } from '@/configs/image-providers'
import { formatGenerationError } from '@/lib/format-generation-error'
import { loadImageApiPrefs, saveImageApiPrefs } from '@/lib/image-api-prefs'
import { Theme, GenerateImageRequest } from '@/types'
import type { ProviderId } from '@/lib/image-providers/types'

export default function Home() {
  const {
    selectedTheme,
    setSelectedTheme,
    setGameData,
    isLoading,
    loadingMessage,
    loadFromLocalStorage,
    getGameDataForTheme,
    removeGameDataForTheme,
    removeProcessedImagesForTheme,
  } = useGameStore()

  const [showGameInterface, setShowGameInterface] = useState(false)
  const [presetThemes, setPresetThemes] = useState<Theme[]>([...PRESET_THEMES])
  const [regeneratingImages, setRegeneratingImages] = useState<{
    character: boolean;
    background: boolean;
    ground: boolean;
    obstacle: boolean;
  }>({ character: false, background: false, ground: false, obstacle: false })
  const themesListRef = useRef<HTMLDivElement>(null)
  const [apiKey, setApiKey] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(getDefaultProvider())
  const [selectedModel, setSelectedModel] = useState(getDefaultModel(getDefaultProvider()))

  const persistImageApiPrefs = (
    provider: ProviderId = selectedProvider,
    model: string = selectedModel,
    key: string = apiKey,
  ) => {
    saveImageApiPrefs({ provider, model, apiKey: key })
  }

  const handleProviderChange = (provider: ProviderId) => {
    setSelectedProvider(provider)
    persistImageApiPrefs(provider, selectedModel, apiKey)
  }

  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    persistImageApiPrefs(selectedProvider, model, apiKey)
  }

  const handleApiKeyChange = (key: string) => {
    setApiKey(key)
    persistImageApiPrefs(selectedProvider, selectedModel, key)
  }

  const saveThemesToStorage = (themes: Theme[]) => {
    try {
      localStorage.setItem('pixel-seed-themes', JSON.stringify(themes))
    } catch (error) {
      console.error('Failed to save themes to localStorage:', error)
    }
  }

  const loadThemesFromStorage = (): Theme[] => {
    try {
      const stored = localStorage.getItem('pixel-seed-themes')
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load themes from localStorage:', error)
    }
    return [...PRESET_THEMES]
  }

  useEffect(() => {
    const storedThemes = loadThemesFromStorage()
    setPresetThemes(storedThemes)
    loadFromLocalStorage()

    const prefs = loadImageApiPrefs()
    setSelectedProvider(prefs.provider)
    setSelectedModel(prefs.model)
    setApiKey(prefs.apiKey)
  }, [loadFromLocalStorage])

  const handleThemeSelect = (themeId: GameTheme) => {
    setSelectedTheme(themeId)
  }

  const handleStartGame = () => {
    setShowGameInterface(true)
  }

  const handleBackToMenu = () => {
    setShowGameInterface(false)
  }

  const handleThemeUpdate = (themes: Theme[]) => {
    setPresetThemes(themes)
    saveThemesToStorage(themes)
  }

  const generateImages = async (requestBody: GenerateImageRequest) => {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const errorData = await response.json().catch(() => null)

    if (!response.ok) {
      const friendly = formatGenerationError(errorData?.error || '')
      if (response.status === 429 || friendly.includes('频率过高')) {
        throw new Error('API 请求频率过高，请稍后再试')
      }
      throw new Error(friendly || errorData?.error || `HTTP error! status: ${response.status}`)
    }

    const result = errorData

    if (!result.success) {
      const friendly = formatGenerationError(result.error || '')
      if (friendly.includes('频率过高')) {
        throw new Error('API 请求频率过高，请稍后再试')
      }
      throw new Error(friendly || result.error || '图像生成失败')
    }

    return result
  }

  const handleDeleteTheme = (themeId: string) => {
    if (!themeId.startsWith('custom-')) {
      message.error('只能删除自定义主题')
      return
    }

    const updatedThemes = presetThemes.filter((theme) => theme.id !== themeId)
    setPresetThemes(updatedThemes)
    saveThemesToStorage(updatedThemes)
    removeGameDataForTheme(themeId)
    removeProcessedImagesForTheme(themeId)

    if (selectedTheme === themeId) {
      setSelectedTheme('fantasy')
    }

    message.success('主题删除成功')
  }

  const handleRegenerateImage = async (
    themeId: string,
    imageType: 'character' | 'background' | 'ground' | 'obstacle',
    apiKey: string,
  ): Promise<void> => {
    setRegeneratingImages((prev) => ({ ...prev, [imageType]: true }))

    try {
      const themeToRegenerate = presetThemes.find((theme) => theme.id === themeId)
      if (!themeToRegenerate) {
        throw new Error('Theme not found')
      }

      const requestBody: GenerateImageRequest = {
        theme: themeToRegenerate.name || themeId,
        prompt: themeToRegenerate.description || '',
        provider: selectedProvider,
        model: selectedModel,
        types: [imageType] as const,
        apiKey: apiKey.trim(),
      }

      const result = await generateImages(requestBody)

      if (result.success && result.data) {
        const urlKey = `${imageType}Url` as const
        const imageKey = `${imageType}Image` as const
        const newUrl = result.data[urlKey] || result.data.levels?.[0]?.[`${imageType}Url`]

        const updatedThemes = presetThemes.map((theme) => {
          if (theme.id !== themeId) return theme
          return {
            ...theme,
            [imageKey]: newUrl || theme[imageKey],
          }
        })

        setPresetThemes(updatedThemes)
        saveThemesToStorage(updatedThemes)

        if (isCustomTheme(themeId) && newUrl) {
          const existingGameData = getGameDataForTheme(themeId)
          if (existingGameData?.data) {
            const updatedGameData = {
              ...existingGameData,
              data: {
                ...existingGameData.data,
                ...(imageType === 'character' ? { characterUrl: newUrl } : {}),
                levels: existingGameData.data.levels.map((level, index) => {
                  if (imageType === 'background') {
                    const levelUrl = result.data.levels?.[index]?.backgroundUrl
                    return levelUrl ? { ...level, backgroundUrl: levelUrl } : level
                  }
                  if (imageType === 'ground' && index === 0) {
                    return { ...level, groundUrl: newUrl }
                  }
                  if (imageType === 'obstacle' && index === 0) {
                    return { ...level, obstacleUrl: newUrl }
                  }
                  return level
                }),
              },
            }
            setGameData(updatedGameData, themeId)
          }
        }

        message.success(`${imageType} regenerated successfully!`)
      } else {
        throw new Error(result.error || '图像重新生成失败')
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '图像重新生成失败')
    } finally {
      setRegeneratingImages((prev) => ({ ...prev, [imageType]: false }))
    }
  }

  const activeGameData = getGameDataForTheme(selectedTheme)

  return (
    <main className="min-h-screen">
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Splitter style={{ height: '100vh' }}>
          <Splitter.Panel
            defaultSize={400}
            min={350}
            max={450}
            style={{
              backgroundColor: '#fff',
              borderRight: '1px solid #e8e8e8',
              boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
            }}
          >
            <SideMenu
              apiKey={apiKey}
              onApiKeyChange={handleApiKeyChange}
              selectedProvider={selectedProvider}
              onProviderChange={handleProviderChange}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              onStartGame={handleStartGame}
              onThemeUpdate={handleThemeUpdate}
              generateImages={generateImages}
              onRegeneratingImagesChange={setRegeneratingImages}
              themesListRef={themesListRef}
            />
          </Splitter.Panel>

          <Splitter.Panel style={{ padding: '20px', overflowY: 'auto' }}>
            {!showGameInterface ? (
              <div style={{ display: 'flex', gap: '20px', width: '100%', height: '100%' }}>
                <ThemesList
                  ref={themesListRef}
                  themes={presetThemes}
                  selectedTheme={selectedTheme}
                  onThemeSelect={handleThemeSelect}
                />

                <ThemePreview
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                  selectedTheme={selectedTheme}
                  themes={presetThemes}
                  gameData={activeGameData}
                  regeneratingImages={regeneratingImages}
                  apiKey={apiKey}
                  onRegenerateImage={handleRegenerateImage}
                  onDeleteTheme={handleDeleteTheme}
                />
              </div>
            ) : (
              <GameCanvas loadingMessage={loadingMessage} onBackToMenu={handleBackToMenu} />
            )}
          </Splitter.Panel>
        </Splitter>
      </div>
    </main>
  )
}
