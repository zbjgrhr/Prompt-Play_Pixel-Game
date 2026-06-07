'use client'

import { Typography, Input, InputNumber, Select, message } from 'antd'
import { ThemeCustomizerProps } from '@/types'
import { PROMPT_TEMPLATES } from '@/configs/prompt-templates'

const { Text } = Typography
const { TextArea } = Input

const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({
  customThemeName,
  onThemeNameChange,
  customPrompt,
  onPromptChange,
  levelCount,
  onLevelCountChange
}) => {
  const handleTemplateSelect = (templateId: string) => {
    const template = PROMPT_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return

    onThemeNameChange(template.themeName)
    onPromptChange(template.prompt)
    onLevelCountChange?.(template.levelCount)
    message.success(`已加载模板：${template.name}`)
  }

  return (
    <>
      {/* 提示词模板 */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: '8px' }}>
          Prompt Template / 提示词模板
        </Text>
        <Select
          placeholder="选择集大成模板一键填充"
          style={{ width: '100%' }}
          allowClear
          onChange={(value) => value && handleTemplateSelect(value)}
          options={PROMPT_TEMPLATES.map((t) => ({
            value: t.id,
            label: t.name,
          }))}
        />
      </div>

      {/* 自定义主题名称 */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: '8px' }}>Custom Theme Name</Text>
        <Input
          value={customThemeName}
          onChange={(e) => onThemeNameChange(e.target.value)}
          placeholder="Enter custom theme name"
          style={{ width: '100%' }}
        />
      </div>

      {/* 自定义Prompt */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: '8px' }}>Custom Prompt</Text>
        <TextArea
          value={customPrompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Enter custom theme description, or load a template above"
          rows={10}
          style={{ width: '100%', fontSize: '12px' }}
        />
      </div>

      {/* 关卡数量 */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: '8px' }}>Level Count</Text>
        <InputNumber
          value={levelCount}
          onChange={(value) => {
            const newValue = value || 1
            onLevelCountChange?.(newValue)

            if (newValue > 3) {
              message.info('Generation results may take more time, please be patient', 3)
            }
          }}
          min={1}
          max={10}
          placeholder="Number of levels"
          style={{ width: '100%' }}
        />
        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
          Generate 1-10 levels (Odyssey template uses 5)
        </Text>
      </div>
    </>
  )
}

export default ThemeCustomizer
