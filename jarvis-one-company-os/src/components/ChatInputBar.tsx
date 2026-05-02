import { useState, useRef, useCallback, useEffect } from 'react'
import type { ChatAttachment, MentionedAgent, QuotedMessage } from '../types'

export interface ChatInputSubmission {
  text: string
  attachments: ChatAttachment[]
  mentions: MentionedAgent[]
  quotedMessage?: QuotedMessage
}

interface Props {
  onSubmit: (submission: ChatInputSubmission) => void
  disabled?: boolean
  placeholder?: string
  quotedMessage?: QuotedMessage | null
  onClearQuote?: () => void
}

const AGENTS: MentionedAgent[] = [
  { agentId: 'jarvis-coo', name: '贾维斯', emoji: '🎯' },
  { agentId: 'hermione-tech', name: '赫敏', emoji: '📚' },
  { agentId: 'mcgonagall-product', name: '麦格教授', emoji: '🐱' },
  { agentId: 'luna-growth', name: '卢娜', emoji: '🌙' },
  { agentId: 'fred-sales', name: '弗雷德', emoji: '🎪' },
  { agentId: 'percy-finance', name: '珀西', emoji: '📊' },
  { agentId: 'snape-audit', name: '斯内普', emoji: '🦇' },
  { agentId: 'dobby-customer', name: '多比', emoji: '🧦' },
]

interface SlashCommand {
  id: string
  label: string
  description: string
  template: string
}

const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'scan', label: '/scan', description: '扫描待处理需求', template: '扫描 ONES 上所有待处理的需求和 bug，给我一个状态报告。' },
  { id: 'report', label: '/report', description: '生成今日报告', template: '生成今天的公司运营日报，包含各部门进展和待办事项。' },
  { id: 'audit', label: '/audit', description: '安全审计检查', template: '对项目进行一次安全审计检查，重点关注代码质量和依赖漏洞。' },
  { id: 'budget', label: '/budget', description: '查看预算状况', template: '查看当前公司 Token 预算使用情况和各部门消耗明细。' },
  { id: 'meeting', label: '/meeting', description: '召集团队讨论', template: '召集全体团队成员开一个讨论会，主题：' },
  { id: 'content', label: '/content', description: '内容生产任务', template: '安排卢娜制作一篇关于以下话题的内容：' },
  { id: 'deploy', label: '/deploy', description: '部署检查', template: '检查所有服务的部署状态和健康状况。' },
  { id: 'growth', label: '/growth', description: '增长数据分析', template: '分析最近的用户增长数据，给出优化建议。' },
]

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface FileSearchResult {
  name: string
  relativePath: string
  size: number
  ext: string
  preview: string
}

interface SpeechRecognitionResultItem {
  transcript: string
}

interface SpeechRecognitionResultLike {
  [index: number]: SpeechRecognitionResultItem
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

export function ChatInputBar({ onSubmit, disabled, placeholder, quotedMessage, onClearQuote }: Props) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [mentions, setMentions] = useState<MentionedAgent[]>([])
  const [showMentionPicker, setShowMentionPicker] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [showFileSearch, setShowFileSearch] = useState(false)
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [fileSearchResults, setFileSearchResults] = useState<FileSearchResult[]>([])
  const [fileSearching, setFileSearching] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const mentionPickerRef = useRef<HTMLDivElement>(null)
  const slashMenuRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const fileSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filteredAgents = AGENTS.filter(a =>
    !mentionFilter || a.name.includes(mentionFilter) || a.agentId.includes(mentionFilter.toLowerCase())
  )

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    !slashFilter || c.label.includes(slashFilter) || c.description.includes(slashFilter)
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (mentionPickerRef.current && !mentionPickerRef.current.contains(e.target as Node)) {
        setShowMentionPicker(false)
      }
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        setShowSlashMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!showFileSearch || !fileSearchQuery.trim()) {
      return
    }
    if (fileSearchTimeoutRef.current) clearTimeout(fileSearchTimeoutRef.current)
    fileSearchTimeoutRef.current = setTimeout(async () => {
      setFileSearching(true)
      try {
        const res = await fetch('/api/chat/search-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: fileSearchQuery.trim(), limit: 15 }),
        })
        if (res.ok) {
          const data = await res.json() as { results?: FileSearchResult[] }
          setFileSearchResults(data.results ?? [])
        }
      } catch (e) { console.warn('[ChatInputBar] file search failed:', e) }
      setFileSearching(false)
    }, 300)
  }, [fileSearchQuery, showFileSearch])

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return
    onSubmit({
      text: trimmed,
      attachments: [...attachments],
      mentions: [...mentions],
      quotedMessage: quotedMessage ?? undefined,
    })
    setText('')
    setAttachments([])
    setMentions([])
    onClearQuote?.()
  }, [text, attachments, mentions, quotedMessage, onSubmit, onClearQuote])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
      return
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)

    const cursorPos = e.target.selectionStart
    const textBefore = val.slice(0, cursorPos)

    const atMatch = textBefore.match(/@([^\s@]*)$/)
    if (atMatch) {
      setMentionFilter(atMatch[1])
      setShowMentionPicker(true)
      setShowSlashMenu(false)
    } else {
      setShowMentionPicker(false)
    }

    if (textBefore === '/' || textBefore.match(/(?:^|\s)\/([^\s]*)$/)) {
      const slashMatch = textBefore.match(/\/([^\s]*)$/)
      setSlashFilter(slashMatch ? slashMatch[1] : '')
      setShowSlashMenu(true)
      setShowMentionPicker(false)
    } else {
      setShowSlashMenu(false)
    }
  }

  const insertMention = (agent: MentionedAgent) => {
    if (!mentions.some(m => m.agentId === agent.agentId)) {
      setMentions(prev => [...prev, agent])
    }
    const cursorPos = textareaRef.current?.selectionStart ?? text.length
    const textBefore = text.slice(0, cursorPos)
    const textAfter = text.slice(cursorPos)
    const newBefore = textBefore.replace(/@[^\s@]*$/, `@${agent.name} `)
    setText(newBefore + textAfter)
    setShowMentionPicker(false)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const insertSlashCommand = (cmd: SlashCommand) => {
    setText(cmd.template)
    setShowSlashMenu(false)
    setTimeout(() => {
      const ta = textareaRef.current
      if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = cmd.template.length }
    }, 0)
  }

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    for (const file of arr) {
      if (file.size > 10 * 1024 * 1024) continue

      const isImage = file.type.startsWith('image/')
      const base64 = await fileToBase64(file)

      if (isImage) {
        const dataUrl = `data:${file.type};base64,${base64}`
        setAttachments(prev => [...prev, {
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'image',
          name: file.name,
          url: dataUrl,
          mimeType: file.type,
          size: file.size,
        }])
      } else {
        try {
          const res = await fetch('/api/chat/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64: base64 }),
          })
          if (res.ok) {
            const data = await res.json() as { file?: { id: string; name: string; mimeType: string; size: number; textContent?: string } }
            if (data.file) {
              const isDoc = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.md', '.txt'].some(e => file.name.toLowerCase().endsWith(e))
              setAttachments(prev => [...prev, {
                id: data.file!.id,
                type: isDoc ? 'document' : 'file',
                name: data.file!.name,
                url: '',
                mimeType: data.file!.mimeType,
                size: data.file!.size,
                textContent: data.file!.textContent,
              }])
            }
          }
        } catch (e) { console.warn('[ChatInputBar] file read failed:', e) }
      }
    }
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageItems: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageItems.push(file)
      }
    }
    if (imageItems.length > 0) {
      e.preventDefault()
      processFiles(imageItems)
    }
  }, [processFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }, [processFiles])

  const addFileReference = useCallback(async (result: FileSearchResult) => {
    try {
      const res = await fetch('/api/chat/read-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relativePath: result.relativePath }),
      })
      if (res.ok) {
        const data = await res.json() as { content?: string; totalLines?: number; fileName?: string }
        setAttachments(prev => [...prev, {
          id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'code_ref',
          name: data.fileName ?? result.name,
          url: '',
          filePath: result.relativePath,
          textContent: data.content?.slice(0, 4000),
          lineRange: [1, data.totalLines ?? 0],
          size: result.size,
        }])
      }
    } catch (e) { console.warn('[ChatInputBar] selectFile failed:', e) }
    setShowFileSearch(false)
    setFileSearchQuery('')
  }, [])

  const toggleVoice = useCallback(() => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition ??
               (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (!SR) return

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    const recognition = new (SR as SpeechRecognitionConstructor)()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('')
      setText(prev => prev + transcript)
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening])

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const removeMention = (agentId: string) => {
    setMentions(prev => prev.filter(m => m.agentId !== agentId))
  }

  const getAttachmentIcon = (att: ChatAttachment) => {
    switch (att.type) {
      case 'image': return '🖼️'
      case 'document': return '📄'
      case 'code_ref': return '📝'
      case 'url_preview': return '🔗'
      default: return '📎'
    }
  }

  return (
    <div
      className={`chat-input-bar${isDragOver ? ' drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="chat-input-drop-overlay">
          <span>📁 释放文件以添加附件</span>
        </div>
      )}

      {quotedMessage && (
        <div className="chat-input-quote">
          <div className="quote-bar" />
          <div className="quote-content">
            <span className="quote-role">{quotedMessage.role === 'ceo' ? '👤 CEO' : '🎯 贾维斯'}</span>
            <span className="quote-text">{quotedMessage.contentPreview}</span>
          </div>
          <button type="button" className="quote-close" onClick={onClearQuote}>×</button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="chat-input-attachments">
          {attachments.map(att => (
            <div key={att.id} className={`attachment-chip attachment-${att.type}`}>
              <span className="attachment-icon">{getAttachmentIcon(att)}</span>
              {att.type === 'image' && att.url && (
                <img src={att.url} alt={att.name} className="attachment-thumb" />
              )}
              <div className="attachment-info">
                <span className="attachment-name">{att.name}</span>
                {att.size && <span className="attachment-size">{formatFileSize(att.size)}</span>}
                {att.filePath && <span className="attachment-path">{att.filePath}</span>}
              </div>
              <button type="button" className="attachment-remove" onClick={() => removeAttachment(att.id)}>×</button>
            </div>
          ))}
        </div>
      )}

      {mentions.length > 0 && (
        <div className="chat-input-mentions">
          {mentions.map(m => (
            <span key={m.agentId} className="mention-chip">
              {m.emoji} @{m.name}
              <button type="button" onClick={() => removeMention(m.agentId)}>×</button>
            </span>
          ))}
        </div>
      )}

      <div className="chat-input-main">
        <div className="chat-input-toolbar">
          <button type="button" title="上传图片 (也可 Ctrl+V 粘贴)" onClick={() => imageInputRef.current?.click()} disabled={disabled}>
            🖼️
          </button>
          <button type="button" title="上传文件/文档" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
            📎
          </button>
          <button type="button" title="引用项目文件" onClick={() => { setShowFileSearch(!showFileSearch); setShowSlashMenu(false) }} disabled={disabled} className={showFileSearch ? 'active' : ''}>
            📄
          </button>
          <button type="button" title="@ 提及角色" onClick={() => { setShowMentionPicker(!showMentionPicker); setShowSlashMenu(false) }} disabled={disabled} className={showMentionPicker ? 'active' : ''}>
            @
          </button>
          <button type="button" title="快捷指令" onClick={() => { setShowSlashMenu(!showSlashMenu); setShowMentionPicker(false) }} disabled={disabled} className={showSlashMenu ? 'active' : ''}>
            ⚡
          </button>
          <button type="button" title="语音输入" onClick={toggleVoice} disabled={disabled} className={isListening ? 'active listening' : ''}>
            🎤
          </button>

          <div className="toolbar-spacer" />
          <span className="toolbar-hint">
            {isListening ? '🔴 录音中...' : 'Enter 发送 · Shift+Enter 换行 · Ctrl+V 粘贴图片'}
          </span>
        </div>

        <div className="chat-input-textarea-wrap">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder ?? '跟贾维斯说点什么... (支持 @提及 /指令 拖拽文件)'}
            rows={2}
            disabled={disabled}
          />
          <button
            type="button"
            className="chat-send-btn"
            disabled={(!text.trim() && attachments.length === 0) || disabled}
            onClick={handleSubmit}
          >
            {disabled ? '思考中...' : '发送'}
          </button>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files) processFiles(e.target.files); e.target.value = '' }}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files) processFiles(e.target.files); e.target.value = '' }}
      />

      {showMentionPicker && (
        <div ref={mentionPickerRef} className="chat-popup mention-popup">
          <div className="popup-header">@ 提及角色</div>
          {filteredAgents.map(a => (
            <button key={a.agentId} type="button" className="popup-item" onClick={() => insertMention(a)}>
              <span className="popup-item-emoji">{a.emoji}</span>
              <span className="popup-item-name">{a.name}</span>
              <span className="popup-item-id">{a.agentId}</span>
            </button>
          ))}
        </div>
      )}

      {showSlashMenu && (
        <div ref={slashMenuRef} className="chat-popup slash-popup">
          <div className="popup-header">⚡ 快捷指令</div>
          {filteredCommands.map(c => (
            <button key={c.id} type="button" className="popup-item" onClick={() => insertSlashCommand(c)}>
              <span className="popup-item-name">{c.label}</span>
              <span className="popup-item-desc">{c.description}</span>
            </button>
          ))}
        </div>
      )}

      {showFileSearch && (
        <div className="chat-popup file-search-popup">
          <div className="popup-header">📄 搜索项目文件</div>
          <input
            type="text"
            className="file-search-input"
            placeholder="输入文件名或内容关键词..."
            value={fileSearchQuery}
            onChange={e => setFileSearchQuery(e.target.value)}
            autoFocus
          />
          {fileSearching && <div className="popup-loading">搜索中...</div>}
          {fileSearchResults.map((r, i) => (
            <button key={i} type="button" className="popup-item file-item" onClick={() => addFileReference(r)}>
              <div className="file-item-top">
                <span className="file-item-name">{r.name}</span>
                <span className="file-item-size">{formatFileSize(r.size)}</span>
              </div>
              <div className="file-item-path">{r.relativePath}</div>
              {r.preview && <div className="file-item-preview">{r.preview}</div>}
            </button>
          ))}
          {!fileSearching && fileSearchQuery && fileSearchResults.length === 0 && (
            <div className="popup-empty">未找到匹配的文件</div>
          )}
        </div>
      )}
    </div>
  )
}
