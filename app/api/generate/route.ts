import { NextRequest, NextResponse } from 'next/server'
import { GAME_TEMPLATES } from '@/configs'
import { getLevelSpecificPrompt } from '@/lib/prompt-utils'

// DashScope API配置
const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

// 请求参数类型
interface GenerateRequest {
  theme: string
  prompt: string
  types?: ('character' | 'background' | 'ground' | 'obstacle')[]
  levelCount?: number // 关卡数量，默认为1
  apiKey?: string
}

class ApiKeyError extends Error {
  constructor() {
    super('API key is required. Set DASHSCOPE_API_KEY or provide apiKey in request body.')
    this.name = 'ApiKeyError'
  }
}

function resolveApiKey(requestKey?: string): string {
  const key = requestKey?.trim() || process.env.DASHSCOPE_API_KEY?.trim()
  if (!key) {
    throw new ApiKeyError()
  }
  return key
}

// 构建游戏风格提示词
function buildPrompt(type: 'character' | 'background' | 'ground' | 'obstacle', theme: string, customPrompt?: string): string {
  const baseTemplate = GAME_TEMPLATES.positive[type]
  const themePrompt = customPrompt || `${theme} style`
  return `${baseTemplate}, ${themePrompt}`
}

// 根据类型获取合适的尺寸（使用API允许的尺寸）
function getSizeForType(type: 'character' | 'background' | 'ground' | 'obstacle'): string {
  switch (type) {
    case 'character':
      return '1328*1328' // 正方形，适合角色
    case 'background':
      return '1664*928'  // 宽屏，适合背景
    case 'ground':
      return '1328*1328' // 正方形，便于无缝拼接和精确控制缺口
    case 'obstacle':
      return '1328*1328' // 正方形，适合障碍物
    default:
      return '1328*1328'
  }
}

// 调用图像抠图处理API
async function processImageCutout(imageUrl: string, type: 'character' | 'background' | 'ground' | 'obstacle'): Promise<string> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/process-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl,
        type
      })
    })

    const result = await response.json()
    
    if (result.success) {
      return result.data.processedUrl
    } else {
      console.warn(`Image processing failed for ${type}, using original image:`, result.error)
      return imageUrl // 如果处理失败，返回原图
    }
  } catch (error) {
    console.warn(`Error processing ${type} image, using original:`, error)
    return imageUrl // 如果出错，返回原图
  }
}

// 调用DashScope API
async function callDashScopeAPI(
  prompt: string,
  type: 'character' | 'background' | 'ground' | 'obstacle',
  apiKey: string,
  size: string = '1328*1328',
  retryCount = 0
): Promise<string> {
  const maxRetries = 3
  const baseDelay = 2000 // 2秒基础延迟
  
  try {
    const negativePrompt = GAME_TEMPLATES.negative[type]

    const response = await fetch(DASHSCOPE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen-image',
        input: {
          messages: [
            {
              role: 'user',
              content: [
                {
                  text: prompt
                }
              ]
            }
          ]
        },
        parameters: {
          negative_prompt: negativePrompt,
          prompt_extend: true,
          watermark: false,
          size: size
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`DashScope API error: ${response.status} - ${errorText}`)
      
      // 检查是否是速率限制错误
       if (response.status === 429 && retryCount < maxRetries) {
         const delay = baseDelay * Math.pow(2, retryCount) // 指数退避
         console.log(`[${new Date().toISOString()}] Rate limit hit for ${type} image generation, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries + 1})`)
         await new Promise(resolve => setTimeout(resolve, delay))
         return callDashScopeAPI(prompt, type, apiKey, size, retryCount + 1)
       }
       
       console.error(`[${new Date().toISOString()}] DashScope API error:`, {
         status: response.status,
         type,
         retryCount,
         errorText
       })
      
      throw error
    }

    const result = await response.json()

    // 检查API响应格式
    if (result.output && result.output.choices && result.output.choices[0] &&
      result.output.choices[0].message && result.output.choices[0].message.content &&
      result.output.choices[0].message.content[0] && result.output.choices[0].message.content[0].image) {
      return result.output.choices[0].message.content[0].image
    }

    throw new Error('Invalid API response format')
  } catch (error) {
    // 如果不是速率限制错误或已达到最大重试次数，直接抛出错误
    if (retryCount >= maxRetries) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Max retries (${maxRetries}) exceeded. Last error: ${errorMessage}`)
    }
    throw error
  }
}

// 生成障碍物配置
function generateObstacleLayout(levelId: string): Array<{
  id: string
  x: number
  y: number
  width: number
  height: number
  type: string
}> {
  const obstacles = []
  const obstacleCount = 3 + Math.floor(Math.random() * 3) // 3-5个障碍物
  
  for (let i = 0; i < obstacleCount; i++) {
    obstacles.push({
      id: `${levelId}-obstacle-${i}`,
      x: 200 + Math.random() * 600, // 随机x位置
      y: 300 + Math.random() * 100, // 随机y位置
      width: 40 + Math.random() * 40, // 随机宽度
      height: 40 + Math.random() * 40, // 随机高度
      type: 'obstacle'
    })
  }
  
  return obstacles
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body: GenerateRequest = await request.json()
    const { theme, prompt, types = ['character', 'background', 'ground', 'obstacle'], levelCount = 1, apiKey: requestApiKey } = body

    const apiKey = resolveApiKey(requestApiKey)

    // 验证请求参数
    if (!theme || !prompt) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: theme and prompt' },
        { status: 400 }
      )
    }

    // 验证levelCount参数
    if (levelCount < 1 || levelCount > 10) {
      return NextResponse.json(
        { success: false, error: 'levelCount must be between 1 and 10' },
        { status: 400 }
      )
    }

    // 性能监控：大量关卡生成时的警告
    if (levelCount > 5) {
      console.warn(`Large generation request: ${levelCount} levels. This may take significant time and resources.`)
    }

    // 验证types参数
    const validTypes = ['character', 'background', 'ground', 'obstacle']
    const invalidTypes = types.filter(type => !validTypes.includes(type))
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid types: ${invalidTypes.join(', ')}` },
        { status: 400 }
      )
    }

    console.log(`Generating ${levelCount} levels with types:`, types)

    // 生成角色图像（只需要一个）
    let characterUrl = ''
    if (types.includes('character')) {
      const characterPrompt = buildPrompt('character', theme, prompt)
      console.log('Generating character image...')
      const originalUrl = await callDashScopeAPI(characterPrompt, 'character', apiKey, getSizeForType('character'))
      
      // 对角色图像自动进行抠图处理
      console.log(`[${new Date().toISOString()}] Auto-processing character image for background removal`)
      characterUrl = await processImageCutout(originalUrl, 'character')
    }

    // 生成多个关卡的背景、地面和障碍物
    const levels = []
    const memoryUsage = process.memoryUsage()
    console.log(`Initial memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`)
    
    for (let levelIndex = 0; levelIndex < levelCount; levelIndex++) {
      const levelStartTime = Date.now()
      const levelId = `level-${levelIndex + 1}`
      console.log(`Generating level ${levelIndex + 1}/${levelCount}...`)
      
      try {
        const level: any = {
          id: levelId,
          obstacles: generateObstacleLayout(levelId)
        }
        
        // 为每个关卡生成背景、地面、障碍物图像
        const levelTypes = types.filter(type => type !== 'character')
        
        for (let i = 0; i < levelTypes.length; i++) {
          const type = levelTypes[i]
          
          // 动态调整延迟：关卡越多，延迟越长
          if (levelIndex > 0 || i > 0) {
            const delay = Math.min(1000 + (levelCount - 3) * 200 + Math.random() * 1000, 3000)
            console.log(`[${new Date().toISOString()}] Adding ${delay}ms delay before generating ${type} image for ${levelId}`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
          
          const levelPrompt = getLevelSpecificPrompt(prompt, levelIndex)
          const typePrompt = buildPrompt(type, theme, levelPrompt)
          const originalUrl = await callDashScopeAPI(typePrompt, type, apiKey, getSizeForType(type))
          
          // 对地面和障碍物图像进行抠图处理
          let finalUrl = originalUrl
          if (type === 'ground' || type === 'obstacle') {
            console.log(`[${new Date().toISOString()}] Auto-processing ${type} image for ${levelId}`)
            finalUrl = await processImageCutout(originalUrl, type)
          }
          
          level[`${type}Url`] = finalUrl
        }
        
        levels.push(level)
        
        const levelEndTime = Date.now()
        console.log(`Level ${levelIndex + 1} completed in ${(levelEndTime - levelStartTime) / 1000}s`)
        
        // 性能监控：检查内存使用情况
        if (levelIndex % 2 === 0 && levelIndex > 0) {
          const currentMemory = process.memoryUsage()
          console.log(`Memory usage after level ${levelIndex + 1}: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`)
          
          // 如果内存使用过高，强制垃圾回收
          if (currentMemory.heapUsed > memoryUsage.heapUsed * 2) {
            if (global.gc) {
              global.gc()
              console.log('Forced garbage collection due to high memory usage')
            }
          }
        }
      } catch (error) {
        console.error(`Error generating level ${levelIndex + 1}:`, error)
        // 如果单个关卡生成失败，使用默认值继续
        levels.push({
          id: levelId,
          obstacles: generateObstacleLayout(levelId)
        })
      }
    }

    // 返回生成结果
    const endTime = Date.now()
    const totalTime = (endTime - startTime) / 1000
    const finalMemory = process.memoryUsage()
    
    console.log(`Generation completed in ${totalTime.toFixed(2)}s for ${levelCount} levels`)
    console.log(`Final memory usage: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`)
    console.log(`Memory delta: ${Math.round((finalMemory.heapUsed - memoryUsage.heapUsed) / 1024 / 1024)}MB`)
    
    const response = {
      success: true,
      data: {
        characterUrl,
        levels
      },
      generationId: `gen_${Date.now()}`,
      timestamp: new Date().toISOString(),
      metadata: {
        generationTime: totalTime,
        levelCount,
        memoryUsed: Math.round(finalMemory.heapUsed / 1024 / 1024)
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Generation error:', error)

    const status = error instanceof ApiKeyError ? 400 : 500

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status }
    )
  }
}

// 支持OPTIONS请求以处理CORS
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