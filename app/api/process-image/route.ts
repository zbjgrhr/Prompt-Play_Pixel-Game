import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

// 请求参数类型
interface ProcessImageRequest {
  imageUrl: string
  type: 'character' | 'background' | 'ground' | 'obstacle'
}

// 下载图像
async function downloadImage(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1]
    if (!base64) {
      throw new Error('Invalid data URL')
    }
    return Buffer.from(base64, 'base64')
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// 抠图处理 - 去除棋盘格背景
async function removeCheckerboardBackground(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(imageBuffer)
    const { width, height } = await image.metadata()
    
    if (!width || !height) {
      throw new Error('Unable to get image dimensions')
    }

    // 获取图像数据
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const channels = info.channels
    const pixelCount = width * height
    const processedData = Buffer.alloc(pixelCount * 4) // RGBA

    // 棋盘格背景的特征颜色（灰色和白色）
    const checkerColors = [
      { r: 204, g: 204, b: 204 }, // 浅灰色
      { r: 255, g: 255, b: 255 }, // 白色
      { r: 192, g: 192, b: 192 }, // 中灰色
      { r: 240, g: 240, b: 240 }, // 浅白色
    ]

    // 颜色相似度阈值
    const threshold = 30

    for (let i = 0; i < pixelCount; i++) {
      const srcOffset = i * channels
      const dstOffset = i * 4

      const r = data[srcOffset]
      const g = data[srcOffset + 1]
      const b = data[srcOffset + 2]
      const a = channels === 4 ? data[srcOffset + 3] : 255

      // 检查是否为棋盘格背景色
      let isBackground = false
      for (const color of checkerColors) {
        const colorDiff = Math.sqrt(
          Math.pow(r - color.r, 2) +
          Math.pow(g - color.g, 2) +
          Math.pow(b - color.b, 2)
        )
        if (colorDiff < threshold) {
          isBackground = true
          break
        }
      }

      // 如果是背景色，设置为透明
      if (isBackground) {
        processedData[dstOffset] = r
        processedData[dstOffset + 1] = g
        processedData[dstOffset + 2] = b
        processedData[dstOffset + 3] = 0 // 透明
      } else {
        processedData[dstOffset] = r
        processedData[dstOffset + 1] = g
        processedData[dstOffset + 2] = b
        processedData[dstOffset + 3] = a
      }
    }

    // 创建处理后的图像
    const processedImage = sharp(processedData, {
      raw: {
        width,
        height,
        channels: 4
      }
    })

    // 应用边缘平滑和噪点清理
    const finalImage = await processedImage
      .png({ quality: 100, compressionLevel: 6 })
      .toBuffer()

    return finalImage
  } catch (error) {
    console.error('Error in removeCheckerboardBackground:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ProcessImageRequest = await request.json()
    const { imageUrl, type } = body

    // 验证请求参数
    if (!imageUrl || !type) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: imageUrl and type' },
        { status: 400 }
      )
    }

    // 验证type参数
    const validTypes = ['character', 'background', 'ground', 'obstacle']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type: ${type}` },
        { status: 400 }
      )
    }

    console.log(`Processing ${type} image: ${imageUrl}`)

    // 下载原始图像
    const originalImageBuffer = await downloadImage(imageUrl)

    // 对所有类型的图像进行抠图处理（去除棋盘格背景）
    let processedImageBuffer: Buffer
    if (type === 'character' || type === 'ground' || type === 'obstacle') {
      processedImageBuffer = await removeCheckerboardBackground(originalImageBuffer)
    } else {
      // 背景类型图像直接返回原图
      processedImageBuffer = originalImageBuffer
    }

    // 将处理后的图像转换为base64
    const base64Image = processedImageBuffer.toString('base64')
    const dataUrl = `data:image/png;base64,${base64Image}`

    const response = {
      success: true,
      data: {
        originalUrl: imageUrl,
        processedUrl: dataUrl,
        type
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Image processing error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}