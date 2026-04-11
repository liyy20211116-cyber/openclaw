import type { ChatMessage } from '../types'

const STORAGE_KEY = 'jarvis-one-company-os.chat-history'
const MAX_MESSAGES = 50

function load(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ChatMessage[]) : []
  } catch {
    return []
  }
}

function save(messages: ChatMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)))
}

export const chatHistoryService = {
  getAll(): ChatMessage[] {
    return load()
  },

  append(message: ChatMessage): ChatMessage[] {
    const messages = load()
    messages.push(message)
    save(messages)
    return messages
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY)
  },
}
