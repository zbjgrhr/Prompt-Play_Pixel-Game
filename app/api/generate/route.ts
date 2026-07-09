import { NextRequest, NextResponse } from 'next/server'
import { formatGenerationError, mapUpstreamHttpStatus } from '@/lib/format-generation-error'
import { buildGamePrompt, getCutoutMode, getNegativeTemplate } from '@/lib/game-prompts'
import { getLevelSpecificPrompt } from '@/lib/prompt-utils'
import {
  getImageProvider,
  normalizeProviderRequest,
  ProviderApiKeyError,
  ProviderValidationError,
  resolveApiKey,
  UpstreamApiError,
} from '@/lib/image-providers'
import type { ProviderId } from '@/lib/image-providers/types'

interface GenerateRequest {
  theme: string
  prompt: string
  provider?: ProviderId
  model?: string
  types?: ('character' | 'background' | 'ground' | 'obstacle')[]
  levelCount?: number
  apiKey?: string
}

function buildPrompt(
  type: 'character' | 'background' | 'ground' | 'obstacle',
  theme: string,
  customPrompt: string | undefined,
  providerId: ProviderId,
  model: string,
): string {
  return buildGamePrompt(type, theme, customPrompt, providerId, model)
}

async function processImageCutout(
  imageUrl: string,
  type: 'character' | 'background' | 'ground' | 'obstacle',
  providerId: ProviderId,
  model: string,
): Promise<string> {
  const cutoutMode = getCutoutMode(providerId, type, model)

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/process-image`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          type,
          cutoutMode: cutoutMode ?? 'checkerboard',
        }),
      },
    )

    const result = await response.json()

    if (result.success) {
      return result.data.processedUrl
    }

    console.warn(`Image processing failed for ${type}, using original image:`, result.error)
    return imageUrl
  } catch (error) {
    console.warn(`Error processing ${type} image, using original:`, error)
    return imageUrl
  }
}

async function generateImageWithProvider(
  providerId: ProviderId,
  model: string,
  apiKey: string,
  type: 'character' | 'background' | 'ground' | 'obstacle',
  prompt: string,
): Promise<string> {
  const provider = getImageProvider(providerId)
  return provider.generateImage({
    prompt,
    negativePrompt: getNegativeTemplate(type, providerId, model),
    assetType: type,
    apiKey,
    model,
  })
}

function generateObstacleLayout(levelId: string): Array<{
  id: string
  x: number
  y: number
  width: number
  height: number
  type: string
}> {
  const obstacles = []
  const obstacleCount = 3 + Math.floor(Math.random() * 3)

  for (let i = 0; i < obstacleCount; i++) {
    obstacles.push({
      id: `${levelId}-obstacle-${i}`,
      x: 200 + Math.random() * 600,
      y: 300 + Math.random() * 100,
      width: 40 + Math.random() * 40,
      height: 40 + Math.random() * 40,
      type: 'obstacle',
    })
  }

  return obstacles
}

function errorResponse(
  error: unknown,
  provider?: ProviderId,
  model?: string,
) {
  if (error instanceof ProviderApiKeyError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        provider: error.provider,
        timestamp: new Date().toISOString(),
      },
      { status: 400 },
    )
  }

  if (error instanceof ProviderValidationError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        provider: error.provider ?? provider,
        timestamp: new Date().toISOString(),
      },
      { status: 400 },
    )
  }

  if (error instanceof UpstreamApiError) {
    const friendlyError = formatGenerationError(error.message)
    const status = mapUpstreamHttpStatus(error.status, error.message)

    return NextResponse.json(
      {
        success: false,
        error: friendlyError,
        rawError: error.message,
        provider: error.provider,
        model: error.model,
        timestamp: new Date().toISOString(),
      },
      { status },
    )
  }

  return NextResponse.json(
    {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      provider,
      model,
      timestamp: new Date().toISOString(),
    },
    { status: 500 },
  )
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let providerId: ProviderId | undefined
  let modelId: string | undefined

  try {
    const body: GenerateRequest = await request.json()
    const {
      theme,
      prompt,
      types = ['character', 'background', 'ground', 'obstacle'],
      levelCount = 1,
      apiKey: requestApiKey,
    } = body

    const normalized = normalizeProviderRequest(body.provider, body.model)
    providerId = normalized.provider
    modelId = normalized.model

    const apiKey = resolveApiKey(providerId, requestApiKey)

    if (!theme || !prompt) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: theme and prompt', provider: providerId },
        { status: 400 },
      )
    }

    if (levelCount < 1 || levelCount > 10) {
      return NextResponse.json(
        { success: false, error: 'levelCount must be between 1 and 10', provider: providerId },
        { status: 400 },
      )
    }

    if (levelCount > 5) {
      console.warn(
        `Large generation request: ${levelCount} levels. This may take significant time and resources.`,
      )
    }

    const validTypes = ['character', 'background', 'ground', 'obstacle']
    const invalidTypes = types.filter((type) => !validTypes.includes(type))
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid types: ${invalidTypes.join(', ')}`, provider: providerId },
        { status: 400 },
      )
    }

    console.log(
      `Generating ${levelCount} levels with provider=${providerId}, model=${modelId}, types:`,
      types,
    )

    let characterUrl = ''
    if (types.includes('character')) {
      const characterPrompt = buildPrompt('character', theme, prompt, providerId, modelId)
      console.log('Generating character image...')
      const originalUrl = await generateImageWithProvider(
        providerId,
        modelId,
        apiKey,
        'character',
        characterPrompt,
      )

      console.log(
        `[${new Date().toISOString()}] Auto-processing character image for background removal`,
      )
      characterUrl = await processImageCutout(originalUrl, 'character', providerId, modelId)
    }

    const levels = []
    const memoryUsage = process.memoryUsage()
    console.log(`Initial memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`)

    for (let levelIndex = 0; levelIndex < levelCount; levelIndex++) {
      const levelStartTime = Date.now()
      const levelId = `level-${levelIndex + 1}`
      console.log(`Generating level ${levelIndex + 1}/${levelCount}...`)

      try {
        const level: Record<string, unknown> = {
          id: levelId,
          obstacles: generateObstacleLayout(levelId),
        }

        const levelTypes = types.filter((type) => type !== 'character')

        for (let i = 0; i < levelTypes.length; i++) {
          const type = levelTypes[i]

          if (levelIndex > 0 || i > 0) {
            const delay = Math.min(1000 + (levelCount - 3) * 200 + Math.random() * 1000, 3000)
            console.log(
              `[${new Date().toISOString()}] Adding ${delay}ms delay before generating ${type} image for ${levelId}`,
            )
            await new Promise((resolve) => setTimeout(resolve, delay))
          }

          const levelPrompt = getLevelSpecificPrompt(prompt, levelIndex)
          const typePrompt = buildPrompt(type, theme, levelPrompt, providerId, modelId)
          const originalUrl = await generateImageWithProvider(
            providerId,
            modelId,
            apiKey,
            type,
            typePrompt,
          )

          let finalUrl = originalUrl
          if (type === 'ground' || type === 'obstacle') {
            console.log(
              `[${new Date().toISOString()}] Auto-processing ${type} image for ${levelId}`,
            )
            finalUrl = await processImageCutout(originalUrl, type, providerId, modelId)
          }

          level[`${type}Url`] = finalUrl
        }

        levels.push(level)

        const levelEndTime = Date.now()
        console.log(`Level ${levelIndex + 1} completed in ${(levelEndTime - levelStartTime) / 1000}s`)

        if (levelIndex % 2 === 0 && levelIndex > 0) {
          const currentMemory = process.memoryUsage()
          console.log(
            `Memory usage after level ${levelIndex + 1}: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`,
          )

          if (currentMemory.heapUsed > memoryUsage.heapUsed * 2) {
            if (global.gc) {
              global.gc()
              console.log('Forced garbage collection due to high memory usage')
            }
          }
        }
      } catch (error) {
        console.error(`Error generating level ${levelIndex + 1}:`, error)
        throw error
      }
    }

    const endTime = Date.now()
    const totalTime = (endTime - startTime) / 1000
    const finalMemory = process.memoryUsage()

    console.log(`Generation completed in ${totalTime.toFixed(2)}s for ${levelCount} levels`)
    console.log(`Final memory usage: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`)

    return NextResponse.json({
      success: true,
      data: {
        characterUrl,
        levels,
      },
      generationId: `gen_${Date.now()}`,
      timestamp: new Date().toISOString(),
      metadata: {
        generationTime: totalTime,
        levelCount,
        provider: providerId,
        model: modelId,
        memoryUsed: Math.round(finalMemory.heapUsed / 1024 / 1024),
      },
    })
  } catch (error) {
    console.error('Generation error:', error)
    return errorResponse(error, providerId, modelId)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
