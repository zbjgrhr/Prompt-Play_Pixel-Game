'use client'

import { Card, Typography, Empty, Image, Button, Skeleton, message, Space } from 'antd'
import { RotateCcw, Trash2, Scissors } from 'lucide-react'
import { DownloadOutlined, RotateLeftOutlined, RotateRightOutlined, SwapOutlined, UndoOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons'
import { ThemePreviewProps } from '@/types'
import { useState, useEffect, useMemo } from 'react'
import { useGameStore } from '@/lib/store'
import { getThemeId, isCustomTheme, isPresetTheme } from '@/lib/theme-utils'

const { Text } = Typography

// 公共样式常量
const COMMON_STYLES = {
  imageContainer: {
    width: '200px',
    aspectRatio: '1' as const,
    borderRadius: '8px',
    objectFit: 'cover' as const
  },
  emptyContainer: {
    width: '100%',
    aspectRatio: '1' as const,
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5'
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'flex-start',
    gap: '8px',
    marginTop: '8px'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '12px'
  }
}

// 图片预览组件
interface ImagePreviewProps {
  imageUrl?: string
  alt: string
  isLoading: boolean
  onProcessImage: () => void
  onRegenerateImage?: () => void
  renderToolbar: (url: string, type: string) => any
  imageType: string
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  imageUrl,
  alt,
  isLoading,
  onProcessImage,
  onRegenerateImage,
  renderToolbar,
  imageType
}) => {
  if (isLoading) {
    return (
      <div className="skeleton-image-full" style={COMMON_STYLES.imageContainer}>
        <Skeleton.Image style={{ width: '100%', height: '100%' }} active />
      </div>
    )
  }

  if (!imageUrl) {
    return (
      <div style={COMMON_STYLES.emptyContainer}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`No ${alt}`}
          style={{ margin: 0 }}
        />
      </div>
    )
  }

  return (
    <>
      <Image
        src={imageUrl}
        alt={alt}
        style={COMMON_STYLES.imageContainer}
        preview={{ toolbarRender: renderToolbar(imageUrl, imageType) }}
      />
      <div style={COMMON_STYLES.buttonGroup}>
        <Button
          size="small"
          icon={<Scissors size={12} />}
          onClick={onProcessImage}
          style={{ padding: '4px 8px', height: '28px', fontSize: '12px' }}
          title="Remove background"
        >
          Cutout
        </Button>
        {onRegenerateImage && (
          <Button
            size="small"
            icon={<RotateCcw size={12} />}
            onClick={onRegenerateImage}
            style={{ padding: '4px 8px', height: '28px', fontSize: '12px' }}
          >
            Regenerate
          </Button>
        )}
      </div>
    </>
  )
}

// 关卡背景网格组件
interface LevelBackgroundsProps {
  levelsData: any[] | null
  renderToolbar: (url: string, type: string) => any
}

const LevelBackgrounds: React.FC<LevelBackgroundsProps> = ({ levelsData, renderToolbar }) => {
  const gridColumns = useMemo(() => {
    if (!levelsData || levelsData.length === 0) return '200px'
    if (levelsData.length === 1) return '200px'
    if (levelsData.length === 2) return 'repeat(2, 200px)'
    if (levelsData.length <= 4) return 'repeat(2, 200px)'
    return 'repeat(3, 200px)'
  }, [levelsData])

  if (!levelsData || levelsData.length === 0) {
    return (
      <div style={COMMON_STYLES.emptyContainer}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No Levels"
          style={{ margin: 0 }}
        />
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: gridColumns,
      gap: '12px',
      justifyContent: 'flex-start'
    }}>
      {levelsData.map((level: any, index: number) => (
        <div key={level.id || index} style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: '4px',
            left: '4px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold',
            zIndex: 1
          }}>
            Level {index + 1}
          </div>
          {level.backgroundUrl ? (
            <Image
              src={level.backgroundUrl}
              alt={`Level ${index + 1} Background`}
              style={COMMON_STYLES.imageContainer}
              preview={{
                toolbarRender: renderToolbar(level.backgroundUrl, `level-${index + 1}-background`)
              }}
            />
          ) : (
            <div style={{
              ...COMMON_STYLES.emptyContainer,
              border: '1px dashed #d9d9d9'
            }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={`Level ${index + 1}`}
                style={{ margin: 0, transform: 'scale(0.8)' }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const ThemePreview: React.FC<ThemePreviewProps> = ({
  isLoading,
  loadingMessage,
  gameData,
  selectedTheme,
  themes,
  regeneratingImages = { character: false, background: false, ground: false, obstacle: false },
  apiKey = '',
  onRegenerateImage,
  onDeleteTheme
}) => {
  const [processingImages, setProcessingImages] = useState<{
    character: boolean;
    background: boolean;
    ground: boolean;
    obstacle: boolean;
  }>({ character: false, background: false, ground: false, obstacle: false })

  // 使用全局状态管理抠图结果
  const { getProcessedImagesForTheme, updateProcessedImage, loadFromLocalStorage } = useGameStore()

  // 组件加载时从localStorage恢复数据
  useEffect(() => {
    loadFromLocalStorage()
  }, [loadFromLocalStorage])
  // 使用useMemo优化图像数据计算
  const { previewImages, levelsData, currentThemeId } = useMemo(() => {
    const themeId = getThemeId(selectedTheme)
    let baseImages: any = {
      character: null,
      background: null,
      ground: null,
      obstacle: null
    }
    let levels = null

    if (selectedTheme && isPresetTheme(selectedTheme)) {
      const theme = themes.find(t => t.id === selectedTheme)
      if (theme) {
        baseImages = {
          character: { url: theme.characterImage },
          background: { url: theme.backgroundImage },
          ground: { url: theme.groundImage },
          obstacle: { url: theme.obstacleImage }
        }
        // 为预设主题创建虚拟关卡数据
        levels = [{ backgroundUrl: theme.backgroundImage }]
      }
    } else if (isCustomTheme(selectedTheme) && gameData?.data) {
      const characterUrl = gameData.data.characterUrl
      const firstLevel = gameData.data.levels?.[0]
      const backgroundUrl = firstLevel?.backgroundUrl
      const groundUrl = firstLevel?.groundUrl

      baseImages = {
        character: characterUrl ? { url: characterUrl } : null,
        background: backgroundUrl ? { url: backgroundUrl } : null,
        ground: groundUrl ? { url: groundUrl } : null,
        obstacle: firstLevel?.obstacleUrl ? { url: firstLevel.obstacleUrl } : null
      }
      levels = gameData.data.levels
    }

    // 获取处理后图像（抠图结果）
    const themeProcessedImages = getProcessedImagesForTheme(themeId)

    const images = {
      character: themeProcessedImages.character ? { url: themeProcessedImages.character } : baseImages.character,
      background: themeProcessedImages.background ? { url: themeProcessedImages.background } : baseImages.background,
      ground: themeProcessedImages.ground ? { url: themeProcessedImages.ground } : baseImages.ground,
      obstacle: themeProcessedImages.obstacle ? { url: themeProcessedImages.obstacle } : baseImages.obstacle
    }

    return {
      previewImages: images,
      levelsData: levels,
      currentThemeId: themeId
    }
  }, [selectedTheme, themes, gameData, getProcessedImagesForTheme])

  // 处理图像下载
  const handleDownloadImage = (imageUrl: string, imageType: string) => {
    if (!imageUrl) {
      message.error('No image to download')
      return
    }

    try {
      const filename = `${imageType}-${Date.now()}.png`

      // 检查是否是base64格式的图片
      if (imageUrl.startsWith('data:image/')) {
        // 直接下载base64图片
        const link = document.createElement('a')
        link.href = imageUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        message.success(`${imageType} image downloaded successfully!`)
      } else {
        // 处理普通URL图片
        fetch(imageUrl)
          .then((response) => {
            if (!response.ok) {
              throw new Error('Network response was not ok')
            }
            return response.blob()
          })
          .then((blob) => {
            // 确保blob是图片类型
            const imageBlob = new Blob([blob], { type: 'image/png' })
            const blobUrl = URL.createObjectURL(imageBlob)
            const link = document.createElement('a')
            link.href = blobUrl
            link.download = filename
            document.body.appendChild(link)
            link.click()
            URL.revokeObjectURL(blobUrl)
            link.remove()
            message.success(`${imageType} image downloaded successfully!`)
          })
          .catch((error) => {
            console.error('Error downloading image:', error)
            message.error(`Error downloading ${imageType} image`)
          })
      }
    } catch (error) {
      console.error('Error in download function:', error)
      message.error(`Error downloading ${imageType} image`)
    }
  }

  // 自定义工具栏渲染函数
  const renderToolbar = (imageUrl: string, imageType: string) => {
    return (
      _: any,
      {
        transform: { scale },
        actions: {
          onFlipY,
          onFlipX,
          onRotateLeft,
          onRotateRight,
          onZoomOut,
          onZoomIn,
          onReset,
        },
      }: any
    ) => (
      <div className="toolbar-wrapper">
        <DownloadOutlined
          onClick={() => handleDownloadImage(imageUrl, imageType)}
        />
        <SwapOutlined
          rotate={90}
          onClick={onFlipY}
        />
        <SwapOutlined
          onClick={onFlipX}
        />
        <RotateLeftOutlined
          onClick={onRotateLeft}
        />
        <RotateRightOutlined
          onClick={onRotateRight}
        />
        <ZoomOutOutlined
          disabled={scale === 1}
          onClick={onZoomOut}
        />
        <ZoomInOutlined
          disabled={scale === 50}
          onClick={onZoomIn}
        />
        <UndoOutlined
          onClick={onReset}
        />
      </div>
    )
  }

  // 处理手动抠图
  const handleProcessImage = async (imageType: 'character' | 'background' | 'ground' | 'obstacle') => {
    const imageUrl = previewImages?.[imageType]?.url

    if (!imageUrl) {
      message.error('No image to process')
      return
    }

    setProcessingImages(prev => ({ ...prev, [imageType]: true }))

    try {
      const response = await fetch('/api/process-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          type: imageType
        })
      })

      const result = await response.json()

      if (result.success) {
        updateProcessedImage(currentThemeId, imageType, result.data.processedUrl)
        message.success(`${imageType} image processed successfully!`)
      } else {
        message.error(`Failed to process ${imageType} image: ${result.error}`)
      }
    } catch (error) {
      console.error('Error processing image:', error)
      message.error(`Error processing ${imageType} image`)
    } finally {
      setProcessingImages(prev => ({ ...prev, [imageType]: false }))
    }
  }

  // 判断当前主题是否可以删除（只有自定义主题可以删除）
  const canDeleteCurrentTheme = () => {
    return selectedTheme && typeof selectedTheme === 'string' && selectedTheme.startsWith('custom-')
  }

  // 获取删除按钮
  const getDeleteButton = () => {
    if (!canDeleteCurrentTheme() || !onDeleteTheme) {
      return null
    }

    return (
      <Button
        type="primary"
        danger
        icon={<Trash2 size={14} />}
        onClick={() => onDeleteTheme(selectedTheme as string)}
        title="删除主题"
      >
        Delete
      </Button>
    )
  }

  return (
    <Card
      title="Theme Preview"
      extra={getDeleteButton()}
      style={{
        flex: 1,
        height: '100%',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
      }}
      styles={{
        body: {
          overflowY: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitScrollbar: 'none'
        } as React.CSSProperties
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 第一行：角色形象 */}
          <div>
            <Text style={COMMON_STYLES.sectionTitle}>Character</Text>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ width: '200px' }}>
                <ImagePreview
                  imageUrl={previewImages?.character?.url}
                  alt="Character"
                  isLoading={regeneratingImages.character || processingImages.character}
                  onProcessImage={() => handleProcessImage('character')}
                  onRegenerateImage={onRegenerateImage ? () => onRegenerateImage(selectedTheme, 'character', apiKey) : undefined}
                  renderToolbar={renderToolbar}
                  imageType="character"
                />
              </div>
            </div>
          </div>

          {/* 第二行：关卡背景 */}
          <div>
            <Text style={COMMON_STYLES.sectionTitle}>Level Backgrounds</Text>
            {(regeneratingImages.background || processingImages.background) ? (
              <div className="skeleton-image-full" style={COMMON_STYLES.imageContainer}>
                <Skeleton.Image style={{ width: '100%', height: '100%' }} active />
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <LevelBackgrounds levelsData={levelsData} renderToolbar={renderToolbar} />
              </div>
            )}
            {!regeneratingImages.background && !processingImages.background && levelsData && levelsData.length > 0 && (
              <div style={COMMON_STYLES.buttonGroup}>
                {onRegenerateImage && (
                  <Button
                    size="small"
                    icon={<RotateCcw size={12} />}
                    onClick={() => onRegenerateImage(selectedTheme, 'background', apiKey)}
                    style={{ padding: '4px 8px', height: '28px', fontSize: '12px' }}
                    loading={regeneratingImages.background}
                  >
                    Regenerate
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 第三行：地面纹理 */}
          <div>
            <Text style={COMMON_STYLES.sectionTitle}>Ground Texture</Text>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ width: '200px' }}>
                <ImagePreview
                  imageUrl={previewImages?.ground?.url}
                  alt="Ground Texture"
                  isLoading={regeneratingImages.ground || processingImages.ground}
                  onProcessImage={() => handleProcessImage('ground')}
                  onRegenerateImage={onRegenerateImage ? () => onRegenerateImage(selectedTheme, 'ground', apiKey) : undefined}
                  renderToolbar={renderToolbar}
                  imageType="ground"
                />
              </div>
            </div>
          </div>

          {/* 第四行：障碍物 */}
          <div>
            <Text style={COMMON_STYLES.sectionTitle}>Obstacle</Text>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ width: '200px' }}>
                <ImagePreview
                  imageUrl={previewImages?.obstacle?.url}
                  alt="Obstacle"
                  isLoading={regeneratingImages.obstacle || processingImages.obstacle}
                  onProcessImage={() => handleProcessImage('obstacle')}
                  onRegenerateImage={onRegenerateImage ? () => onRegenerateImage(selectedTheme, 'obstacle', apiKey) : undefined}
                  renderToolbar={renderToolbar}
                  imageType="obstacle"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default ThemePreview