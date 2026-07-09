'use client'

import { Typography, Select, Input, message } from 'antd'
import Image from 'next/image'
import {
  getDefaultModel,
  getProviderConfig,
  IMAGE_PROVIDERS,
} from '@/configs/image-providers'
import type { ProviderId } from '@/lib/image-providers/types'
import { ModelSelectorProps } from '@/types'

const { Text } = Typography
const { Option } = Select

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedProvider,
  onProviderChange,
  selectedModel,
  onModelChange,
  apiKey,
  onApiKeyChange,
}) => {
  const providerConfig = getProviderConfig(selectedProvider)
  const models = providerConfig?.models ?? []

  const handleProviderChange = (provider: ProviderId) => {
    onProviderChange(provider)
    onModelChange(getDefaultModel(provider))
  }

  const handleApiKeyChange = (value: string) => {
    onApiKeyChange(value)
    if (value.startsWith('sk-proj-') && selectedProvider === 'dashscope') {
      message.warning('This looks like an OpenAI key. Consider switching Provider to OpenAI.')
    }
  }

  return (
    <>
      <div>
        <Text strong style={{ display: 'block', marginBottom: '8px' }}>
          Provider / 平台
        </Text>
        <Select
          value={selectedProvider}
          onChange={handleProviderChange}
          style={{ width: '100%' }}
          placeholder="Select provider"
        >
          {IMAGE_PROVIDERS.map((provider) => (
            <Option key={provider.id} value={provider.id}>
              {provider.labelZh} · {provider.label}
            </Option>
          ))}
        </Select>
      </div>

      <div>
        <Text strong style={{ display: 'block', marginBottom: '8px' }}>
          Model / 模型
        </Text>
        <Select
          value={selectedModel}
          onChange={onModelChange}
          style={{ width: '100%' }}
          placeholder="Select a model"
        >
          {models.map((model) => (
            <Option key={model.id} value={model.id}>
              {selectedProvider === 'dashscope' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Image src="/qwen.svg" alt="Qwen" width={16} height={16} />
                  {model.label}
                </div>
              ) : (
                model.label
              )}
            </Option>
          ))}
        </Select>
        {selectedProvider === 'openrouter' && (
          <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
            聚合 API · 一个 Key 可选多模型（含 Grok）
          </Text>
        )}
      </div>

      <div>
        <Text strong style={{ display: 'block', marginBottom: '8px' }}>API Key</Text>
        <Input.Password
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder={providerConfig?.keyHint ?? 'Enter your API key'}
          style={{ width: '100%' }}
          autoComplete="off"
        />
        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
          {providerConfig?.keyHintZh}
        </Text>
      </div>
    </>
  )
}

export default ModelSelector
