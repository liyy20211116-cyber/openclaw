import type { ChatMessage } from '../types'

export interface ChatTopic {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

const API_BASE = import.meta.env.VITE_WRITEBACK_API_BASE_URL ?? '/api'
const TOPICS_KEY = 'jarvis-os.chat-topics'
const MESSAGES_PREFIX = 'jarvis-os.chat-msgs.'
const ACTIVE_KEY = 'jarvis-os.chat-active-topic'
const MIGRATED_FLAG = 'jarvis-os.chat-migrated-to-db'

let cachedTopics: ChatTopic[] | null = null
const messageCache = new Map<string, ChatMessage[]>()

let apiAvailable = true
let apiRetryAt = 0

async function api<T = Record<string, unknown>>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!apiAvailable && Date.now() < apiRetryAt) {
    throw new Error('Chat API temporarily unavailable')
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error ?? 'Chat API request failed')
    apiAvailable = true
    return data as T
  } catch (e) {
    console.warn(`[ChatStore] API ${path} failed:`, e)
    apiAvailable = false
    apiRetryAt = Date.now() + 10000
    throw e
  }
}

function genId(): string {
  return `topic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (message.role !== 'ceo' || message.id.includes('_ceo')) return message
    return {
      ...message,
      id: `${message.id}_legacy_relabel`,
      role: 'jarvis',
      content: `【历史记录，非 CEO 手动输入】\n${message.content}`,
    }
  })
}

async function migrateFromLocalStorage(): Promise<void> {
  if (localStorage.getItem(MIGRATED_FLAG)) return

  try {
    const raw = localStorage.getItem(TOPICS_KEY)
    const oldTopics: ChatTopic[] = raw ? JSON.parse(raw) : []

    const OLD_KEY = 'jarvis-one-company-os.chat-history'
    const oldHistoryRaw = localStorage.getItem(OLD_KEY)
    if (oldHistoryRaw && oldTopics.length === 0) {
      const msgs = JSON.parse(oldHistoryRaw) as ChatMessage[]
      if (msgs.length > 0) {
        oldTopics.push({
          id: genId(),
          title: '历史对话',
          createdAt: msgs[0]?.createdAt ?? new Date().toISOString(),
          updatedAt: msgs[msgs.length - 1]?.createdAt ?? new Date().toISOString(),
          messageCount: msgs.length,
        })
        localStorage.setItem(MESSAGES_PREFIX + oldTopics[0].id, JSON.stringify(normalizeMessages(msgs)))
      }
    }

    if (oldTopics.length === 0) {
      localStorage.setItem(MIGRATED_FLAG, '1')
      return
    }

    const importPayload = oldTopics.map(t => {
      let msgs: ChatMessage[] = []
      try {
        const msgRaw = localStorage.getItem(MESSAGES_PREFIX + t.id)
        msgs = msgRaw ? normalizeMessages(JSON.parse(msgRaw)) : []
      } catch { /* skip corrupted */ }
      return { ...t, messages: msgs }
    })

    await api('/chat/import', { topics: importPayload })
    localStorage.setItem(MIGRATED_FLAG, '1')
    console.log(`[ChatStore] Migrated ${oldTopics.length} topics to database`)
  } catch (e) {
    console.warn('[ChatStore] Migration from localStorage failed, will retry next time:', e)
  }
}

let migrationPromise: Promise<void> | null = null
function ensureMigrated(): Promise<void> {
  if (!migrationPromise) migrationPromise = migrateFromLocalStorage()
  return migrationPromise
}

function getLocalTopics(): ChatTopic[] {
  try {
    const raw = localStorage.getItem(TOPICS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveLocalTopics(topics: ChatTopic[]) {
  localStorage.setItem(TOPICS_KEY, JSON.stringify(topics))
}

function getLocalMessages(topicId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(MESSAGES_PREFIX + topicId)
    return raw ? normalizeMessages(JSON.parse(raw)) : []
  } catch { return [] }
}

function saveLocalMessages(topicId: string, messages: ChatMessage[]) {
  localStorage.setItem(MESSAGES_PREFIX + topicId, JSON.stringify(messages))
}

export const chatTopicService = {
  async getTopics(): Promise<ChatTopic[]> {
    await ensureMigrated()
    try {
      const data = await api<{ topics: ChatTopic[] }>('/chat/topics')
      const topics = (data.topics ?? []).map(t => ({
        ...t,
        createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date(t.createdAt).toISOString(),
        updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : new Date(t.updatedAt).toISOString(),
      }))
      cachedTopics = topics
      saveLocalTopics(topics)
      return topics
    } catch (e) {
      console.warn('[ChatStore] getTopics API failed, fallback to local:', e)
      if (cachedTopics && cachedTopics.length > 0) return cachedTopics
      return getLocalTopics()
    }
  },

  getActiveTopicId(): string | null {
    return localStorage.getItem(ACTIVE_KEY)
  },

  setActiveTopicId(id: string) {
    localStorage.setItem(ACTIVE_KEY, id)
  },

  async createTopic(title: string): Promise<ChatTopic> {
    await ensureMigrated()
    try {
      const data = await api<{ topic: ChatTopic }>('/chat/topic/create', { title })
      const topic = {
        ...data.topic,
        createdAt: typeof data.topic.createdAt === 'string' ? data.topic.createdAt : new Date(data.topic.createdAt).toISOString(),
        updatedAt: typeof data.topic.updatedAt === 'string' ? data.topic.updatedAt : new Date(data.topic.updatedAt).toISOString(),
      }
      localStorage.setItem(ACTIVE_KEY, topic.id)
      cachedTopics = null
      return topic
    } catch (e) {
      console.warn('[ChatStore] createTopic API failed, creating locally:', e)
      const now = new Date().toISOString()
      const topic: ChatTopic = {
        id: genId(), title, createdAt: now, updatedAt: now, messageCount: 0,
      }
      const local = getLocalTopics()
      local.unshift(topic)
      saveLocalTopics(local)
      cachedTopics = local
      localStorage.setItem(ACTIVE_KEY, topic.id)
      return topic
    }
  },

  async renameTopic(id: string, title: string): Promise<void> {
    try {
      await api('/chat/topic/rename', { id, title })
    } catch {
      const local = getLocalTopics()
      const idx = local.findIndex(t => t.id === id)
      if (idx >= 0) { local[idx].title = title; saveLocalTopics(local) }
    }
    cachedTopics = null
  },

  async deleteTopic(id: string): Promise<void> {
    try {
      await api('/chat/topic/delete', { id })
    } catch {
      const local = getLocalTopics().filter(t => t.id !== id)
      saveLocalTopics(local)
    }
    messageCache.delete(id)
    localStorage.removeItem(MESSAGES_PREFIX + id)
    cachedTopics = null
    const active = localStorage.getItem(ACTIVE_KEY)
    if (active === id) {
      localStorage.removeItem(ACTIVE_KEY)
    }
  },

  async getMessages(topicId: string): Promise<ChatMessage[]> {
    await ensureMigrated()
    try {
      const data = await api<{ messages: ChatMessage[] }>('/chat/messages', { topicId })
      const messages = normalizeMessages(data.messages ?? [])
      messageCache.set(topicId, messages)
      saveLocalMessages(topicId, messages)
      return messages
    } catch (e) {
      console.warn('[ChatStore] getMessages API failed, fallback to local:', e)
      const cached = messageCache.get(topicId)
      if (cached && cached.length > 0) return cached
      return getLocalMessages(topicId)
    }
  },

  async appendMessage(topicId: string, message: ChatMessage): Promise<void> {
    const safeMessage = normalizeMessages([message])[0]
    const cached = messageCache.get(topicId) ?? []
    cached.push(safeMessage)
    messageCache.set(topicId, cached)
    saveLocalMessages(topicId, cached)

    const local = getLocalTopics()
    const idx = local.findIndex(t => t.id === topicId)
    if (idx >= 0) {
      local[idx].messageCount = cached.length
      local[idx].updatedAt = new Date().toISOString()
      saveLocalTopics(local)
    }

    try {
      await api('/chat/message/append', { topicId, message: safeMessage })
      cachedTopics = null
    } catch (e) {
      console.warn('[ChatStore] appendMessage API failed, saved locally:', e)
    }
  },

  async clearMessages(topicId: string): Promise<void> {
    messageCache.delete(topicId)
    localStorage.removeItem(MESSAGES_PREFIX + topicId)
    try {
      await api('/chat/messages/clear', { topicId })
    } catch { /* local already cleared */ }
    cachedTopics = null
  },
}
