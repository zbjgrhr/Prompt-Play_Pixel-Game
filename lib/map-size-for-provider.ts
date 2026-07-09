import type { AssetType, ProviderId } from '@/lib/image-providers/types'

export function getSizeForProvider(
  providerId: ProviderId,
  assetType: AssetType,
  _modelId?: string,
): string {
  if (providerId === 'dashscope') {
    switch (assetType) {
      case 'background':
        return '1664*928'
      case 'character':
      case 'ground':
      case 'obstacle':
      default:
        return '1328*1328'
    }
  }

  switch (assetType) {
    case 'background':
      return '1792x1024'
    case 'character':
    case 'ground':
    case 'obstacle':
    default:
      return '1024x1024'
  }
}
