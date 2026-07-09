import { GAME_TEMPLATES } from '@/configs'
import type { ProviderId } from '@/lib/image-providers/types'

export type GameAssetType = 'character' | 'background' | 'ground' | 'obstacle'
export type CutoutMode = 'checkerboard' | 'chroma-green'

const CHARACTER_BASE =
  '2D side-scrolling pixel art character sprite, 16-bit retro style, high contrast colors, hand-drawn pixel texture, sharp pixel outline, bold silhouette, complete full body from head to feet, facing right, side profile view, standing upright, centered on canvas, expressive design, theme-appropriate clothing and accessories, no cropping, no cut-off limbs'

const CHARACTER_DASHSCOPE_BG =
  'plain light gray and white checkerboard background only, isolated character on checkerboard, no scene, no environment, no props, no border, no frame, no UI box, no sprite sheet grid'

const CHARACTER_OPENAI_BG =
  'single flat solid bright green chroma key background color #00FF00 only, plain uniform green backdrop, no scene, no environment, no ground, no props, no border, no frame, no UI box, no sprite sheet grid, no checkerboard, no transparency grid, no shadow on background, isolated character only'

const CHARACTER_NEGATIVE_SHARED =
  '3D render, photorealistic, blurry, smooth gradients, environmental objects, scenery, buildings, ground, sky, props, atmospheric effects, multiple characters, cropped limbs, front view, back view, three-quarter view, facing left'

const CHARACTER_NEGATIVE_DASHSCOPE =
  'border, frame, picture frame, card layout, UI panel, sprite sheet layout, tile grid, box around character, scene background, white solid background, colored scene background'

const CHARACTER_NEGATIVE_OPENAI =
  'checkerboard, transparency grid, border, frame, picture frame, card, UI panel, sprite sheet, tile grid, box around character, scene background, white background, gray background, gradient background, neon green clothing covering entire body'

const OBSTACLE_OPENAI_BG =
  'single flat solid bright green chroma key background #00FF00 only, no border, no frame, no checkerboard, isolated object only'

const OBSTACLE_DASHSCOPE_BG =
  'plain light gray and white checkerboard background only, isolated object on checkerboard, no border, no frame, no sprite sheet grid'

function usesChromaKey(providerId: ProviderId, model?: string): boolean {
  if (providerId === 'dashscope') return false
  if (providerId === 'openai') return true
  if (providerId === 'openrouter' && model && /gpt-image/i.test(model)) return true
  return providerId === 'openrouter'
}

export function getCutoutMode(
  providerId: ProviderId,
  type: GameAssetType,
  model?: string,
): CutoutMode | null {
  if (type === 'background') return null
  return usesChromaKey(providerId, model) ? 'chroma-green' : 'checkerboard'
}

export function getPositiveTemplate(
  type: GameAssetType,
  providerId: ProviderId,
  model?: string,
): string {
  if (type === 'character') {
    const bg = usesChromaKey(providerId, model)
      ? CHARACTER_OPENAI_BG
      : CHARACTER_DASHSCOPE_BG
    return `${CHARACTER_BASE}, ${bg}`
  }

  if (type === 'obstacle') {
    const base = GAME_TEMPLATES.positive.obstacle
    const bg = usesChromaKey(providerId, model) ? OBSTACLE_OPENAI_BG : OBSTACLE_DASHSCOPE_BG
    return base
      .replace(
        /absolutely pure checkerboard background pattern with alternating light gray and white squares, completely isolated obstacle sprite on checkerboard transparency grid, zero environmental interference, clean sprite extraction with checkerboard background, optimal game asset format with checkerboard transparency indicator/g,
        bg,
      )
  }

  if (type === 'ground' && usesChromaKey(providerId, model)) {
    return `${GAME_TEMPLATES.positive.ground}, ${OBSTACLE_OPENAI_BG}`
  }

  return GAME_TEMPLATES.positive[type]
}

export function getNegativeTemplate(
  type: GameAssetType,
  providerId: ProviderId,
  model?: string,
): string {
  if (type === 'character') {
    const extra = usesChromaKey(providerId, model)
      ? CHARACTER_NEGATIVE_OPENAI
      : CHARACTER_NEGATIVE_DASHSCOPE
    return `${CHARACTER_NEGATIVE_SHARED}, ${extra}`
  }

  return GAME_TEMPLATES.negative[type]
}

export function buildGamePrompt(
  type: GameAssetType,
  theme: string,
  customPrompt: string | undefined,
  providerId: ProviderId,
  model?: string,
): string {
  const baseTemplate = getPositiveTemplate(type, providerId, model)
  const themePrompt = customPrompt?.trim() || `${theme} style`
  return `${baseTemplate}, ${themePrompt}`
}
