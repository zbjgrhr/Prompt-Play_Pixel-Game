'use client'

import { Card, Drawer, Tabs, Select, Slider, Switch, Typography } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { GameCanvasProps } from '@/types'
import { PRESET_THEMES } from '@/configs'
import { GAME_STORY } from '@/configs/game-story'
import { GAME_MANUAL } from '@/configs/game-manual'
import { getThemeId, isCustomTheme, isPresetTheme } from '@/lib/theme-utils'
import {
  GameSettings,
  DEFAULT_GAME_SETTINGS,
  loadGameSettings,
  saveGameSettings,
  getGraphicsFilter,
} from '@/lib/game-settings'
import {
  buildGroundTiles,
  buildLevelObstacles,
  computeStandY,
  getParallaxOffset,
  PLAYER_GROUND_Y,
} from '@/lib/level-layout'

const { Text, Paragraph } = Typography

type SettingsTab = 'settings' | 'story' | 'manual'

const GameCanvas: React.FC<GameCanvasProps> = ({
  loadingProgress = 0,
  loadingMessage = 'Loading...',
  onBackToMenu
}) => {
  const [isMobile, setIsMobile] = useState(false)
  const gameCanvasRef = useRef<HTMLDivElement>(null)
  const imageCache = useRef<{ [key: string]: HTMLImageElement }>({})

  // Canvas组件的状态和逻辑
  const {
    gameData,
    processedImages,
    playerPosition,
    setPlayerPosition,
    setGameState,
    resetGame,
    selectedTheme,
    groundTiles,
    groundHeight,
    obstacles,
    setGroundTiles,
    setObstacles,
    isCollisionEnabled,
    loadFromLocalStorage,
    getProcessedImagesForTheme,
    currentLevelIndex,
    totalLevels,
    nextLevel,
    isLastLevel,
    getCurrentLevel,
  } = useGameStore()

  const gameLoopRef = useRef({
    currentLevelIndex,
    totalLevels,
    gameData,
    isLastLevel,
    nextLevel,
    initializeLevelLayout: () => {},
    preloadImages: async (_urls: { [key: string]: string }) => {},
  })

  const isTransitioningRef = useRef(false)
  const [levelTransition, setLevelTransition] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('settings')
  const [gameSettings, setGameSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS)
  const wasPausedBeforeSettings = useRef(false)
  const [currentAction, setCurrentAction] = useState('Idle')

  // 组件加载时从localStorage恢复数据
  useEffect(() => {
    loadFromLocalStorage()
    setGameSettings(loadGameSettings())
  }, [loadFromLocalStorage])

  const updateGameSettings = useCallback((patch: Partial<GameSettings>) => {
    setGameSettings((prev) => {
      const next = { ...prev, ...patch }
      saveGameSettings(next)
      return next
    })
  }, [])

  const handleOpenSettings = useCallback((tab: SettingsTab = 'settings') => {
    wasPausedBeforeSettings.current = isPaused
    setSettingsTab(tab)
    setSettingsOpen(true)
  }, [isPaused])

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false)
    if (!isGameOver) {
      setIsPaused(wasPausedBeforeSettings.current)
    }
  }, [isGameOver])

  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [preloadedImages, setPreloadedImages] = useState<{ [key: string]: boolean }>({})
  const [isPreloading, setIsPreloading] = useState(false)

  const getCanvasWidth = useCallback(() => {
    if (gameCanvasRef.current) {
      const rect = gameCanvasRef.current.getBoundingClientRect()
      return Math.max(rect.width, 1000)
    }
    return 1000
  }, [])

  const initializeLevelLayout = useCallback(() => {
    const canvasWidth = getCanvasWidth()
    const level = getCurrentLevel()
    const tiles = buildGroundTiles(canvasWidth, currentLevelIndex)
    const generated = buildLevelObstacles(
      canvasWidth,
      currentLevelIndex,
      level?.obstacles,
    )
    setGroundTiles(tiles)
    setObstacles(generated)
  }, [getCanvasWidth, getCurrentLevel, currentLevelIndex, setGroundTiles, setObstacles])

  // 设置玩家初始位置
  const setPlayerInitialPosition = useCallback(() => {
    const initialX = 50
    setPlayerPosition({ x: initialX, y: PLAYER_GROUND_Y })
  }, [setPlayerPosition])

  // 获取实际使用的图像URL（优先使用抠图结果）
  const getActualImageUrls = useCallback(() => {
    const currentLevel = getCurrentLevel()
    const baseUrls = {
      character: gameData?.data?.characterUrl || '',
      background: currentLevel?.backgroundUrl || '',
      ground: currentLevel?.groundUrl || '',
      obstacle: currentLevel?.obstacleUrl || ''
    }

    // 获取当前主题的抠图结果
    const currentThemeId = getThemeId(selectedTheme)
    const themeProcessedImages = getProcessedImagesForTheme(currentThemeId)

    return {
      character: themeProcessedImages.character || baseUrls.character,
      background: themeProcessedImages.background || baseUrls.background,
      ground: themeProcessedImages.ground || baseUrls.ground,
      obstacle: themeProcessedImages.obstacle || baseUrls.obstacle
    }
  }, [gameData, selectedTheme, getProcessedImagesForTheme, getCurrentLevel])

  useEffect(() => {
    initializeLevelLayout()
    setPlayerInitialPosition()
    isTransitioningRef.current = false
    setLevelTransition(null)
  }, [initializeLevelLayout, setPlayerInitialPosition, selectedTheme, currentLevelIndex])


  // 键盘控制
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // ESC键处理暂停/恢复 - 只在非游戏结束状态下生效
    if (e.key === 'Escape' && !isGameOver) {
      if (settingsOpen) {
        handleCloseSettings()
      } else {
        setIsPaused((prev) => !prev)
      }
      return
    }

    if (isPaused || isGameOver || settingsOpen || levelTransition) return
    setKeys(prev => new Set(prev).add(e.key.toLowerCase()))
  }, [isGameOver, isPaused, settingsOpen, levelTransition, handleCloseSettings])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    setKeys(prev => {
      const newKeys = new Set(prev)
      newKeys.delete(e.key.toLowerCase())
      return newKeys
    })
  }, [])

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768)
      // 当屏幕尺寸改变时，重新初始化地面以适应新的画布宽度
      setTimeout(() => {
        initializeLevelLayout()
      }, 100)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('resize', checkScreenSize)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp, initializeLevelLayout])

  // 碰撞检测函数
  const checkCollision = useCallback((x: number, y: number, width: number = 48, height: number = 48) => {
    if (!isCollisionEnabled) return false

    // 检查与障碍物的碰撞
    for (const obstacle of obstacles) {
      if (x < obstacle.x + obstacle.width &&
        x + width > obstacle.x &&
        y < obstacle.y + obstacle.height &&
        y + height > obstacle.y) {
        return true
      }
    }
    return false
  }, [obstacles, isCollisionEnabled])

  // 角色物理状态
  const [character, setCharacter] = useState({
    x: 50,
    y: 352, // 与障碍物位置一致，紧贴地面纹理上方
    width: 48,
    height: 48,
    velocityY: 0,
    isJumping: false,
    onGround: true,
    facingDirection: 1 // 1为右，-1为左
  })

  // 游戏循环 - 使用requestAnimationFrame优化性能
  useEffect(() => {
    if (isPaused || isGameOver || settingsOpen || levelTransition) return

    let animationId: number
    let lastTime = 0
    const targetFPS = 60
    const frameTime = 1000 / targetFPS

    const gameLoop = (currentTime: number) => {
      if (currentTime - lastTime >= frameTime) {
        setCharacter(prev => {
          let newX = prev.x
          let newY = prev.y
          let newVelocityY = prev.velocityY
          let newIsJumping = prev.isJumping
          let newOnGround = prev.onGround
          let action = 'idle'
          const playerWidth = 48
          const playerHeight = 48
          const gravity = 0.8
          const jumpPower = -15
          const groundY = computeStandY(newX, playerWidth, obstacles)

          let newFacingDirection = prev.facingDirection

          // 左右移动逻辑
          if (keys.has('a') || keys.has('arrowleft')) {
            const testX = Math.max(0, newX - 5)
            if (!checkCollision(testX, newY, playerWidth, playerHeight)) {
              newX = testX
              newFacingDirection = -1 // 面向左
              action = 'Moving Left'
            }
          }
          if (keys.has('d') || keys.has('arrowright')) {
            const testX = newX + 5
            // 动态获取游戏画布的实际宽度和位置
            let gameEndBoundary = 900 // 默认值作为后备
            if (gameCanvasRef.current) {
              const rect = gameCanvasRef.current.getBoundingClientRect()
              const actualCanvasWidth = rect.width
              gameEndBoundary = actualCanvasWidth - playerWidth - 50 // 增加安全边距，确保能触发游戏结束
            }
            if (testX >= gameEndBoundary && !isTransitioningRef.current) {
              const loopState = gameLoopRef.current
              if (loopState.isLastLevel()) {
                isTransitioningRef.current = true
                const victoryMessages = [
                  '🏆 Victory! You conquered the dragon kingdom!',
                  '🎯 Quest Complete! The realm is restored!',
                  '⭐ Legendary! All zones cleared!',
                  '🐉 The ancient dragon has been reached — you win!',
                  '🚀 Epic adventure complete! True hero!'
                ]
                const randomMessage = victoryMessages[Math.floor(Math.random() * victoryMessages.length)]
                setCurrentAction(`Victory - ${randomMessage}`)
                setTimeout(() => {
                  setIsGameOver(true)
                  isTransitioningRef.current = false
                }, 0)
              } else {
                isTransitioningRef.current = true
                const completedLevel = loopState.currentLevelIndex + 1
                const nextLevelNum = completedLevel + 1
                setLevelTransition(`第 ${completedLevel} 关完成 → 进入第 ${nextLevelNum} 关`)
                setCurrentAction(`Level ${completedLevel} complete`)

                setTimeout(async () => {
                  const state = gameLoopRef.current
                  const nextLevelIndex = state.currentLevelIndex + 1
                  const levels = state.gameData?.data?.levels
                  if (levels && nextLevelIndex < levels.length) {
                    const nextLevelData = levels[nextLevelIndex]
                    const nextLevelImages: { [key: string]: string } = {}
                    if (nextLevelData.backgroundUrl) nextLevelImages.background = nextLevelData.backgroundUrl
                    if (nextLevelData.groundUrl) nextLevelImages.ground = nextLevelData.groundUrl
                    if (nextLevelData.obstacleUrl) nextLevelImages.obstacle = nextLevelData.obstacleUrl

                    if (Object.keys(nextLevelImages).length > 0) {
                      await state.preloadImages(nextLevelImages)
                    }
                  }

                  state.nextLevel()
                  setCharacter((prev) => ({
                    ...prev,
                    x: 50,
                    y: PLAYER_GROUND_Y,
                    velocityY: 0,
                    isJumping: false,
                    onGround: true,
                  }))
                  state.initializeLevelLayout()
                  setLevelTransition(null)
                  isTransitioningRef.current = false
                  setCurrentAction('Level started!')
                }, 1500)
              }
            } else if (!checkCollision(testX, newY, playerWidth, playerHeight)) {
              newX = testX
              newFacingDirection = 1 // 面向右
              action = 'Moving Right'
            }
          }

          // 跳跃逻辑 - 只有在地面上才能跳跃
          if (keys.has(' ') && newOnGround) {
            newVelocityY = jumpPower
            newIsJumping = true
            newOnGround = false
            action = 'Jumping'
          }

          // 改进的重力和碰撞系统
          if (!newOnGround) {
            newVelocityY += gravity
            const testY = newY + newVelocityY

            // 检查是否落地（地面）
            if (testY >= groundY) {
              newY = groundY
              newVelocityY = 0
              newIsJumping = false
              newOnGround = true
            } else {
              // 检查是否落在障碍物上
              let landedOnObstacle = false
              for (const obstacle of obstacles) {
                if (newX + playerWidth > obstacle.x &&
                  newX < obstacle.x + obstacle.width &&
                  testY + playerHeight >= obstacle.y &&
                  testY + playerHeight <= obstacle.y + 10 && // 允许10px的着陆容差
                  newVelocityY > 0) { // 只有下落时才能着陆
                  newY = obstacle.y - playerHeight
                  newVelocityY = 0
                  newIsJumping = false
                  newOnGround = true
                  landedOnObstacle = true
                  break
                }
              }

              if (!landedOnObstacle) {
                newY = testY
              }
            }
          } else {
            // 在地面或障碍物上时，检查是否仍有支撑
            let hasSupport = false

            const standY = computeStandY(newX, playerWidth, obstacles)
            if (Math.abs(newY - standY) <= 5) {
              hasSupport = true
            } else {
              // 检查障碍物支撑
              for (const obstacle of obstacles) {
                if (newX + playerWidth > obstacle.x &&
                  newX < obstacle.x + obstacle.width &&
                  Math.abs(newY + playerHeight - obstacle.y) <= 5) {
                  hasSupport = true
                  break
                }
              }
            }

            // 如果没有支撑，开始下落
            if (!hasSupport) {
              newOnGround = false
              newVelocityY = 0
            }
          }

          // 碰撞检测
          if (checkCollision(newX, newY, playerWidth, playerHeight)) {
            // 如果发生碰撞，恢复到之前的位置
            newX = prev.x
            newY = prev.y
          }

          if (action === 'idle' && newOnGround) {
            setCurrentAction('Idle')
          } else {
            setCurrentAction(action)
          }

          // 更新玩家位置
          setPlayerPosition({ x: newX, y: newY })

          return {
            x: newX,
            y: newY,
            width: playerWidth,
            height: playerHeight,
            velocityY: newVelocityY,
            isJumping: newIsJumping,
            onGround: newOnGround,
            facingDirection: newFacingDirection
          }
        })

        lastTime = currentTime
      }

      animationId = requestAnimationFrame(gameLoop)
    }

    animationId = requestAnimationFrame(gameLoop)

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [keys, isPaused, isGameOver, settingsOpen, levelTransition, setPlayerPosition, checkCollision, obstacles])

  const handleBackToMenu = () => {
    resetGame()
    setIsGameOver(false)
    setIsPaused(false)
    setLevelTransition(null)
    isTransitioningRef.current = false
    setGameState('menu')
    if (onBackToMenu) {
      onBackToMenu()
    }
  }

  const togglePause = () => {
    setIsPaused((prev) => !prev)
  }

  // 图像预加载函数
  const preloadImages = useCallback(async (imageUrls: { [key: string]: string }) => {
    setIsPreloading(true)
    const loadPromises = Object.entries(imageUrls).map(([key, url]) => {
      return new Promise<void>((resolve, reject) => {
        if (!url || preloadedImages[url]) {
          resolve()
          return
        }

        const img = new Image()
        img.onload = () => {
          imageCache.current[url] = img
          setPreloadedImages(prev => ({ ...prev, [url]: true }))
          resolve()
        }
        img.onerror = () => {
          console.warn(`Failed to preload image: ${url}`)
          resolve() // 即使失败也继续，不阻塞游戏
        }
        img.src = url
      })
    })

    await Promise.all(loadPromises)
    setIsPreloading(false)
  }, [preloadedImages])

  useEffect(() => {
    gameLoopRef.current = {
      currentLevelIndex,
      totalLevels,
      gameData,
      isLastLevel,
      nextLevel,
      initializeLevelLayout,
      preloadImages,
    }
  }, [currentLevelIndex, totalLevels, gameData, isLastLevel, nextLevel, initializeLevelLayout, preloadImages])

  // 预加载当前关卡图像
  useEffect(() => {
    const themeImages = getThemeImages()
    const imagesToPreload = {
      character: themeImages.character,
      background: themeImages.background,
      ground: themeImages.ground,
      obstacle: themeImages.obstacle
    }

    // 过滤掉空值
    const validImages = Object.fromEntries(
      Object.entries(imagesToPreload).filter(([_, url]) => url)
    )

    if (Object.keys(validImages).length > 0) {
      preloadImages(validImages)
    }
  }, [selectedTheme, currentLevelIndex, preloadImages])

  // 获取当前游戏边界值的函数
  const getCurrentGameBoundary = useCallback(() => {
    if (gameCanvasRef.current) {
      const rect = gameCanvasRef.current.getBoundingClientRect()
      const actualCanvasWidth = rect.width
      return actualCanvasWidth - 48 - 50 // 增加安全边距，确保角色能触发游戏结束
    }
    return 900 // 调整默认值
  }, [])

  // 获取当前主题的预览图片（优先使用localStorage中的更新数据）
  const getThemeImages = () => {
    if (selectedTheme && isPresetTheme(selectedTheme)) {
      // 首先尝试从localStorage中获取更新后的主题数据
      let updatedTheme = null
      try {
        const savedThemes = localStorage.getItem('pixel-seed-themes')
        if (savedThemes) {
          const themes = JSON.parse(savedThemes)
          updatedTheme = themes.find((t: any) => t.id === selectedTheme)
        }
      } catch (error) {
        console.error('  读取localStorage主题数据失败:', error)
      }

      // 如果没有找到更新的主题数据，使用默认配置
      const theme = updatedTheme || PRESET_THEMES.find(t => t.id === selectedTheme)

      if (theme) {
        // 对于预设主题，也检查是否有抠图结果
        const actualUrls = getActualImageUrls()
        const themeImages = {
          character: actualUrls.character || theme.characterImage,
          background: actualUrls.background || theme.backgroundImage,
          ground: actualUrls.ground || theme.groundImage,
          obstacle: actualUrls.obstacle || theme.obstacleImage
        }
        return themeImages
      }
    }
    if (isCustomTheme(selectedTheme) && (getCurrentLevel() || Object.keys(processedImages).length > 0)) {
      const actualUrls = getActualImageUrls()
      const customImages = {
        character: actualUrls.character,
        background: actualUrls.background,
        ground: actualUrls.ground,
        obstacle: actualUrls.obstacle
      }
      return customImages
    }
    return {
      character: null,
      background: null,
      ground: null,
      obstacle: null
    }
  }

  const cardPadding = isMobile ? '12px' : '20px'
  const themeImages = getThemeImages()

  return (
    <Card
      title="Pixel World"
      style={{
        flex: 1,
        height: '100%',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
      bodyStyle={{
        flex: 1,
        padding: cardPadding,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fafafa'
      }}
    >
      {/* 游戏内容区域 */}
      <div
        ref={gameCanvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          border: '1px solid #e9ecef',
          minHeight: isMobile ? '300px' : '400px',
          position: 'relative'
        }}>
        {/* 游戏Canvas内容 */}
        <div
          className="w-full h-full relative overflow-hidden"
          style={{
            backgroundImage: themeImages.background ? `url(${themeImages.background})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundSize: 'cover',
            backgroundPosition: getParallaxOffset(playerPosition.x),
            backgroundRepeat: 'no-repeat',
            filter: getGraphicsFilter(gameSettings.graphicsQuality),
          }}
        >
          <div className="relative w-full h-full">
            {/* 地面瓦片 */}
            {groundTiles.map(tile => (
              <div
                key={tile.id}
                className="absolute"
                style={{
                  left: tile.x,
                  top: tile.y,
                  width: tile.width,
                  height: tile.height,
                  backgroundImage: themeImages.ground ? `url(${themeImages.ground})` : 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,.1) 2px, rgba(255,255,255,.1) 4px)',
                  backgroundColor: themeImages.ground ? 'transparent' : '#8B4513',
                  backgroundSize: 'contain',
                  backgroundPosition: 'top left',
                  backgroundRepeat: 'repeat',
                }}
              />
            ))}

            {/* 障碍物 */}
            {obstacles.filter((o) => o.type !== 'platform').map(obstacle => {
              const currentLevel = getCurrentLevel()
              const obstacleUrl = currentLevel?.obstacleUrl || themeImages.obstacle
              return (
                <div
                  key={obstacle.id}
                  className="absolute rounded"
                  style={{
                    left: obstacle.x,
                    top: obstacle.y,
                    width: obstacle.width,
                    height: obstacle.height,
                    backgroundImage: obstacleUrl ? `url(${obstacleUrl})` : 'none',
                    backgroundColor: obstacleUrl ? 'transparent' : '#654321',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }}
                />
              )
            })}

            {/* 角色 */}
            <motion.div
              className="absolute w-12 h-12 sm:w-16 sm:h-16 z-10"
              style={{
                left: playerPosition.x,
                top: playerPosition.y,
              }}
              animate={{
                scaleX: character.facingDirection,
              }}
              transition={{ duration: 0.1 }}
            >
              <div
                className="w-full h-full bg-cover bg-center bg-no-repeat pixelated"
                style={{
                  backgroundImage: themeImages.character ? `url(${themeImages.character})` : 'none',
                  backgroundColor: themeImages.character ? 'transparent' : '#4a5568',
                  borderRadius: themeImages.character ? '0' : '50%'
                }}
              >
                {!themeImages.character && (
                  <div className="w-full h-full flex items-center justify-center text-white text-2xl">
                    🎮
                  </div>
                )}
              </div>
            </motion.div>

            {/* 地面指示线（开发用） */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-white/20" style={{ bottom: '125px' }} />

            {/* 游戏UI — 右上角菜单按钮 */}
            <div className="absolute top-0 right-0 p-2 z-40 flex flex-col items-end gap-2">
              <button
                onClick={() => handleOpenSettings('settings')}
                className="w-9 h-9 flex items-center justify-center bg-black/50 backdrop-blur-sm border border-white/20 rounded-lg text-white hover:bg-white/20 transition-all duration-200"
                title="菜单 Menu"
                aria-label="Open settings menu"
              >
                <MenuOutlined style={{ fontSize: '16px' }} />
              </button>
              {gameSettings.showDebugInfo && (
                <div className="bg-black/50 backdrop-blur-sm border border-white/20 rounded-lg p-2 text-white font-mono text-xs">
                  <div className="space-y-1">
                    <p>Level: {currentLevelIndex + 1}/{totalLevels}</p>
                    <p>Pos: ({Math.round(playerPosition.x)}, {Math.round(playerPosition.y)})</p>
                    <p>Action: {currentAction}</p>
                    <p>Status: {levelTransition ? 'Transition' : settingsOpen ? 'Menu' : isPaused ? 'Paused' : 'Playing'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 游戏内设置 Drawer */}
            <Drawer
              title={<span className="text-white font-mono">☰ 菜单 Menu</span>}
              placement="right"
              open={settingsOpen}
              onClose={handleCloseSettings}
              getContainer={false}
              width={isMobile ? '85%' : 300}
              zIndex={50}
              styles={{
                header: {
                  background: 'rgba(0, 0, 0, 0.85)',
                  borderBottom: '1px solid rgba(255,255,255,0.15)',
                },
                body: {
                  background: 'rgba(0, 0, 0, 0.88)',
                  padding: '12px 16px',
                },
                mask: {
                  background: 'rgba(0, 0, 0, 0.45)',
                },
              }}
              className="game-settings-drawer"
            >
              <div className="flex flex-col gap-2 mb-4 pb-4 border-b border-white/15">
                <Text className="!text-gray-400 !text-xs font-mono block mb-1">
                  游戏控制 · Game Controls
                </Text>
                <button
                  type="button"
                  onClick={() => setIsPaused((prev) => !prev)}
                  className="w-full px-2 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded font-mono text-xs text-white transition-all duration-200"
                >
                  {isPaused ? '▶ 继续 Resume' : '⏸ 暂停 Pause'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCloseSettings()
                    handleBackToMenu()
                  }}
                  className="w-full px-2 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded font-mono text-xs text-white transition-all duration-200"
                >
                  🏠 返回主菜单 Back to Menu
                </button>
              </div>
              <Tabs
                activeKey={settingsTab}
                onChange={(key) => setSettingsTab(key as SettingsTab)}
                size="small"
                items={[
                  {
                    key: 'settings',
                    label: '设置',
                    children: (
                      <div className="space-y-5 text-white font-mono text-xs">
                        <div>
                          <Text className="!text-gray-300 block mb-2">画面 Graphics</Text>
                          <Select
                            value={gameSettings.graphicsQuality}
                            onChange={(v) => updateGameSettings({ graphicsQuality: v })}
                            style={{ width: '100%' }}
                            options={[
                              { value: 'low', label: '流畅 Low' },
                              { value: 'medium', label: '标准 Medium' },
                              { value: 'high', label: '高清 High' },
                            ]}
                          />
                        </div>
                        <div>
                          <Text className="!text-gray-300 block mb-2">
                            音量 Volume · {gameSettings.masterVolume}%
                          </Text>
                          <Slider
                            min={0}
                            max={100}
                            value={gameSettings.masterVolume}
                            onChange={(v) => updateGameSettings({ masterVolume: v })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Text className="!text-gray-300">音效 Sound FX</Text>
                          <Switch
                            checked={gameSettings.soundEnabled}
                            onChange={(v) => updateGameSettings({ soundEnabled: v })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Text className="!text-gray-300">音乐 Music</Text>
                          <Switch
                            checked={gameSettings.musicEnabled}
                            onChange={(v) => updateGameSettings({ musicEnabled: v })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Text className="!text-gray-300">调试信息 Debug</Text>
                          <Switch
                            checked={gameSettings.showDebugInfo}
                            onChange={(v) => updateGameSettings({ showDebugInfo: v })}
                          />
                        </div>
                        <Paragraph className="!text-gray-500 !text-xs !mb-0">
                          音量与音乐功能即将推出 · Audio coming soon
                        </Paragraph>
                      </div>
                    ),
                  },
                  {
                    key: 'story',
                    label: '剧情',
                    children: (
                      <div className="text-white font-mono text-xs space-y-4">
                        <Text strong className="!text-blue-300 !text-sm block">
                          {GAME_STORY.title}
                        </Text>
                        {GAME_STORY.sections.map((section) => (
                          <div key={section.heading}>
                            <Text className="!text-orange-300 block mb-1">{section.heading}</Text>
                            <Paragraph className="!text-gray-300 !text-xs whitespace-pre-line !mb-0">
                              {section.body}
                            </Paragraph>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: 'manual',
                    label: '说明书',
                    children: (
                      <div className="text-white font-mono text-xs space-y-4">
                        <Text strong className="!text-blue-300 !text-sm block">
                          {GAME_MANUAL.title}
                        </Text>
                        {GAME_MANUAL.sections.map((section) => (
                          <div key={section.heading}>
                            <Text className="!text-orange-300 block mb-1">{section.heading}</Text>
                            <ul className="list-disc pl-4 space-y-1 text-gray-300">
                              {section.items.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </Drawer>

            {/* 关卡切换遮罩 */}
            {levelTransition && !settingsOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-black/60 flex items-center justify-center z-35 pointer-events-none"
              >
                <div className="text-center px-6">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white font-mono mb-2">
                    {levelTransition}
                  </h2>
                  <p className="text-yellow-200 font-mono text-sm">关卡切换中…</p>
                </div>
              </motion.div>
            )}

            {/* 暂停/游戏结束遮罩 */}
            {(isPaused || isGameOver) && !settingsOpen && !levelTransition && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-black/50 flex items-center justify-center z-30 cursor-pointer"
                onClick={isGameOver ? handleBackToMenu : togglePause}
              >
                <div className="text-center">
                  <h2 className="text-4xl font-bold text-white font-mono mb-4">
                    {isGameOver
                      ? (currentAction.startsWith('Victory') ? '🏆 Victory!' : 'Game Over!')
                      : 'Game Paused'}
                  </h2>
                  <p className="text-gray-300 font-mono mb-2">
                    {isGameOver
                      ? currentAction.replace(/^Victory - |^Game Over - /, '')
                      : 'Press ESC or click anywhere to continue'}
                  </p>
                  {isGameOver && currentAction.startsWith('Victory') && (
                    <p className="text-yellow-300 font-mono text-sm">
                      🌟 All levels cleared — Pixel World Odyssey complete!
                    </p>
                  )}
                  {isGameOver && (
                    <button
                      onClick={handleBackToMenu}
                      className="mt-4 px-6 py-2 bg-gradient-to-r from-blue-500/30 to-purple-500/30 hover:from-blue-500/40 hover:to-purple-500/40 border border-white/40 rounded-lg text-white font-mono transition-all duration-200 transform hover:scale-105"
                    >
                      🏠 Back to Menu
                    </button>
                  )}
                </div>
              </motion.div>
            )}

          </div>
        </div>
      </div>
    </Card>
  )
}

export default GameCanvas