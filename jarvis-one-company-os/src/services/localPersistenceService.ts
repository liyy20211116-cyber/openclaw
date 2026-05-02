const STORAGE_PREFIX = 'one_company_os:'

export const localStateKeys = {
  opportunities: 'opportunities',
  opportunityDrafts: 'opportunity_drafts',
  opportunityIntakeRecords: 'opportunity_intake_records',
  salesLeads: 'sales_leads',
  workflowRuns: 'workflow_runs',
  workflowSteps: 'workflow_steps',
  revenueRecords: 'revenue_records',
  dailyRuns: 'daily_runs',
  dailyRunLogs: 'daily_run_logs',
  mockApprovalRequests: 'mock_approval_requests',
  unifiedApprovals: 'unified_approvals',
  tenantConfig: 'tenant_config',
  selectedIndustryTemplate: 'selected_industry_template',
  selectedAgentTeamTemplate: 'selected_agent_team_template',
  demoProfile: 'demo_profile',
} as const

type LocalSnapshot = Record<string, unknown>

const memoryStorage = new Map<string, string>()

function namespacedKey(key: string) {
  return key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`
}

function publicKey(key: string) {
  return key.startsWith(STORAGE_PREFIX) ? key.slice(STORAGE_PREFIX.length) : key
}

function getBrowserStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage
    const probeKey = `${STORAGE_PREFIX}__probe__`
    storage.setItem(probeKey, '1')
    storage.removeItem(probeKey)
    return storage
  } catch {
    return null
  }
}

function readRaw(key: string): string | null {
  const fullKey = namespacedKey(key)
  const storage = getBrowserStorage()
  return storage ? storage.getItem(fullKey) : memoryStorage.get(fullKey) ?? null
}

function writeRaw(key: string, value: string) {
  const fullKey = namespacedKey(key)
  const storage = getBrowserStorage()
  if (storage) storage.setItem(fullKey, value)
  else memoryStorage.set(fullKey, value)
}

function removeRaw(key: string) {
  const fullKey = namespacedKey(key)
  const storage = getBrowserStorage()
  if (storage) storage.removeItem(fullKey)
  else memoryStorage.delete(fullKey)
}

function clone<T>(value: T): T {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value)) as T
}

export function getItem<T>(key: string, fallback: T): T {
  const raw = readRaw(key)
  if (raw === null) return clone(fallback)
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn(`[localPersistenceService] Failed to parse ${namespacedKey(key)}. Falling back to seed.`, error)
    return clone(fallback)
  }
}

export function setItem<T>(key: string, value: T): T {
  writeRaw(key, JSON.stringify(value))
  return clone(value)
}

export function removeItem(key: string) {
  removeRaw(key)
}

export function resetItem(key: string) {
  removeItem(key)
}

export function getOrSeed<T>(key: string, seedValue: T): T {
  const raw = readRaw(key)
  if (raw === null) {
    return setItem(key, seedValue)
  }
  return getItem(key, seedValue)
}

export function updateItem<T>(key: string, updater: (value: T) => T, seedValue: T): T {
  const current = getOrSeed(key, seedValue)
  return setItem(key, updater(current))
}

export function listLocalStateKeys(): string[] {
  const storage = getBrowserStorage()
  if (storage) {
    const keys: string[] = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(publicKey(key))
    }
    return keys.sort()
  }
  return [...memoryStorage.keys()]
    .filter(key => key.startsWith(STORAGE_PREFIX))
    .map(publicKey)
    .sort()
}

export function clearAllOneCompanyLocalState() {
  const keys = listLocalStateKeys()
  keys.forEach(removeItem)
}

export function exportAllOneCompanyLocalState(): LocalSnapshot {
  return listLocalStateKeys().reduce<LocalSnapshot>((snapshot, key) => {
    snapshot[key] = getItem<unknown>(key, null)
    return snapshot
  }, {})
}

export function importAllOneCompanyLocalState(snapshot: LocalSnapshot) {
  Object.entries(snapshot).forEach(([key, value]) => {
    setItem(key, value)
  })
}

export const localPersistenceService = {
  getItem,
  setItem,
  removeItem,
  resetItem,
  getOrSeed,
  updateItem,
  clearAllOneCompanyLocalState,
  exportAllOneCompanyLocalState,
  importAllOneCompanyLocalState,
  listLocalStateKeys,
}
