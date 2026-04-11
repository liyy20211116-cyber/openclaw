import { useState, useEffect, useRef } from 'react'
import type { LlmModelInfo } from '../services/llmService'
import { fetchAvailableModels, setSelectedProvider, getSelectedProvider, getLastUsedModel } from '../services/llmService'

interface Props {
  onModelChange?: (providerId: string, modelName: string) => void
}

const PROVIDER_ICONS: Record<string, string> = {
  cascade: '🔄',
  'fandai-nn4.6': '🧠',
  'fandai-gemini3.1': '💎',
  'fandai-gpt5.4': '🤖',
  'fandai-nshen5.4-med': '⚡',
  'fandai-nshen-mini': '🐇',
  openai: '🟢',
  deepseek: '🐋',
  moonshot: '🌙',
  siliconflow: '🌊',
  'ollama-local': '🏠',
  configured: '⚙️',
}

export function ModelSelector({ onModelChange }: Props) {
  const [models, setModels] = useState<LlmModelInfo[]>([])
  const [selected, setSelected] = useState(getSelectedProvider())
  const [open, setOpen] = useState(false)
  const [lastModel, setLastModel] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAvailableModels().then(setModels)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      const m = getLastUsedModel()
      if (m && m !== lastModel) setLastModel(m)
    }, 2000)
    return () => clearInterval(t)
  }, [lastModel])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = (model: LlmModelInfo) => {
    setSelected(model.id)
    setSelectedProvider(model.id)
    setOpen(false)
    onModelChange?.(model.id, model.name)
  }

  const current = models.find(m => m.id === selected) ?? { id: 'cascade', name: '自动级联', provider: 'auto' }
  const icon = PROVIDER_ICONS[current.id] ?? '🤖'

  return (
    <div ref={ref} className="model-selector">
      <button
        type="button"
        className="model-selector-btn"
        onClick={() => setOpen(!open)}
        title="切换 LLM 模型"
      >
        <span className="model-icon">{icon}</span>
        <span className="model-name">{current.name}</span>
        {lastModel && selected === 'cascade' && (
          <span className="model-actual">({lastModel})</span>
        )}
        <span className="model-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && models.length > 0 && (
        <div className="model-dropdown">
          <div className="model-dropdown-header">选择 LLM 模型</div>
          {models.map(m => (
            <button
              key={m.id}
              type="button"
              className={`model-option${m.id === selected ? ' active' : ''}`}
              onClick={() => handleSelect(m)}
            >
              <span className="model-option-icon">{PROVIDER_ICONS[m.id] ?? '🤖'}</span>
              <div className="model-option-info">
                <span className="model-option-name">{m.name}</span>
                <span className="model-option-desc">{m.description}</span>
              </div>
              {m.id === selected && <span className="model-option-check">✓</span>}
              {m.isDefault && <span className="model-option-badge">推荐</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
