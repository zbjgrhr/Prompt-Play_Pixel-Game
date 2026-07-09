import {
  GenerateImageParams,
  UpstreamApiError,
} from '@/lib/image-providers/types'

interface OpenAICompatibleOptions {
  baseUrl: string
  providerLabel: string
  extraHeaders?: Record<string, string>
}

function buildPromptWithNegative(prompt: string, negativePrompt?: string): string {
  if (!negativePrompt?.trim()) return prompt
  return `${prompt}. Avoid: ${negativePrompt}`
}

function parseImageResponse(result: {
  data?: Array<{ url?: string; b64_json?: string }>
}): string {
  const first = result.data?.[0]
  if (first?.url) return first.url
  if (first?.b64_json) {
    return `data:image/png;base64,${first.b64_json}`
  }
  throw new Error('Invalid image API response format')
}

export async function callOpenAICompatibleImagesAPI(
  params: GenerateImageParams,
  options: OpenAICompatibleOptions,
): Promise<string> {
  const prompt = buildPromptWithNegative(params.prompt, params.negativePrompt)
  const size = params.size ?? '1024x1024'

  const response = await fetch(`${options.baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
      ...options.extraHeaders,
    },
    body: JSON.stringify({
      model: params.model,
      prompt,
      n: 1,
      size,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new UpstreamApiError(
      options.providerLabel as 'openai' | 'openrouter',
      params.model,
      response.status,
      errorText,
    )
  }

  const result = await response.json()
  return parseImageResponse(result)
}
