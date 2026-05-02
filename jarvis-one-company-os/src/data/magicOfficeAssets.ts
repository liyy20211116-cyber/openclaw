const MAGIC_OFFICE_ASSET_ROOT = '/magic-office'

export const supportedMagicOfficeThemes = [
  'original-magic-company',
  'cyber-office',
  'space-command',
] as const

export type MagicOfficeThemeId = typeof supportedMagicOfficeThemes[number]
export type MagicAgentImageState = 'idle' | 'working' | 'blocked'

type MagicImageAsset = {
  src: string
}

export type MagicThemeAssets = MagicImageAsset & {
  id: MagicOfficeThemeId
  background: string
}

export type MagicRoomAsset = MagicImageAsset & {
  themeId: MagicOfficeThemeId
  roomId: string
  fallbackSymbol: string
}

export type MagicAgentAsset = MagicImageAsset & {
  avatarStyle: string
  folder: string
  state: MagicAgentImageState
  fallbackSymbol: string
}

export type MagicEffectAsset = MagicImageAsset & {
  effect: 'approval' | 'blocked' | 'syncing' | 'completed'
}

const themeAliases: Record<string, MagicOfficeThemeId> = {
  original: 'original-magic-company',
  original_magic_company: 'original-magic-company',
  originalMagicCompany: 'original-magic-company',
  'original-magic-company': 'original-magic-company',
  cyber: 'cyber-office',
  cyber_office: 'cyber-office',
  cyberOffice: 'cyber-office',
  'cyber-office': 'cyber-office',
  space: 'space-command',
  space_command: 'space-command',
  spaceCommand: 'space-command',
  'space-command': 'space-command',
}

const avatarAssetFolders: Record<string, string> = {
  arcane_coo: 'chief-arcane-operator',
  moonlit_creator: 'owl-growth-mage',
  owl_merchant: 'owl-growth-mage',
  service_sprite: 'service-sprite',
  vault_keeper: 'vault-keeper',
  ward_auditor: 'ward-auditor',
  spell_engineer: 'spell-engineer',
  alchemy_product: 'alchemy-product',
  training_keeper: 'training-keeper',
}

const avatarFallbackSymbols: Record<string, string> = {
  arcane_coo: 'A',
  moonlit_creator: 'M',
  owl_merchant: 'O',
  service_sprite: 'S',
  vault_keeper: 'V',
  ward_auditor: 'W',
  spell_engineer: 'E',
  alchemy_product: 'P',
  training_keeper: 'T',
}

const themeBackgroundFiles: Partial<Record<MagicOfficeThemeId, string>> = {
  'original-magic-company': 'background.webp.png',
}

const roomAssetFilesByTheme: Partial<Record<MagicOfficeThemeId, Record<string, string>>> = {
  'original-magic-company': {
    command_hall: 'command_hall.webp.png',
    crystal_studio: 'crystal_studio.webp.png',
    gold_vault: 'gold_vault.webp.png',
    owl_station: 'owl_station.webp.png',
    ward_room: 'ward_room.webp.png',
  },
}

const agentAssetFilesByFolder: Record<string, Partial<Record<MagicAgentImageState, string>>> = {
  'chief-arcane-operator': {
    idle: 'idle.png',
    working: 'working.png',
    blocked: 'blocked.png',
  },
  'owl-growth-mage': {
    idle: 'idle.png',
    working: 'working.png',
    blocked: 'blocked.png',
  },
  'vault-keeper': {
    idle: 'idle.png',
    working: 'working.png',
    blocked: 'blocked.png',
  },
}

const effectAssetFiles: Record<MagicEffectAsset['effect'], string> = {
  approval: 'approval.webp.png',
  blocked: 'blocked.webp.png',
  syncing: 'syncing.webp.png',
  completed: 'completed.webp.png',
}

const stateAssetMap: Record<string, MagicAgentImageState> = {
  idle: 'idle',
  waiting: 'idle',
  waiting_approval: 'working',
  coordinating: 'working',
  writing: 'working',
  syncing: 'working',
  lead_following: 'working',
  accounting: 'working',
  guarding: 'working',
  learning: 'working',
  working: 'working',
  blocked: 'blocked',
}

const effectAssetMap: Record<string, MagicEffectAsset['effect'] | undefined> = {
  waiting_approval: 'approval',
  blocked: 'blocked',
  syncing: 'syncing',
  completed: 'completed',
}

function normalizeKey(value: string) {
  return value.trim().replace(/\s+/g, '-')
}

function toSlug(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return slug || fallback
}

function roomFallbackSymbol(roomId: string) {
  const parts = roomId.split(/[_-]/).filter(Boolean)
  const symbol = parts.map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return symbol || '?'
}

export function normalizeMagicOfficeTheme(theme?: string | null): MagicOfficeThemeId {
  if (!theme) return 'original-magic-company'

  const rawKey = normalizeKey(theme)
  const snakeKey = theme.trim().replace(/[-\s]+/g, '_')
  const normalizedKey = toSlug(theme, 'original-magic-company')

  return themeAliases[theme] ?? themeAliases[rawKey] ?? themeAliases[snakeKey] ?? themeAliases[normalizedKey] ?? 'original-magic-company'
}

export function getMagicOfficeThemeAssets(theme?: string | null): MagicThemeAssets {
  const id = normalizeMagicOfficeTheme(theme)
  const backgroundFile = themeBackgroundFiles[id] ?? 'background.webp'

  return {
    id,
    src: `${MAGIC_OFFICE_ASSET_ROOT}/themes/${id}/${backgroundFile}`,
    background: `${MAGIC_OFFICE_ASSET_ROOT}/themes/${id}/${backgroundFile}`,
  }
}

export function getMagicRoomAsset(theme: string | null | undefined, roomId: string): MagicRoomAsset {
  const themeId = normalizeMagicOfficeTheme(theme)
  const normalizedRoomId = roomId || 'unknown-room'
  const roomFile = roomAssetFilesByTheme[themeId]?.[normalizedRoomId] ?? `${normalizedRoomId}.webp`

  return {
    themeId,
    roomId: normalizedRoomId,
    src: `${MAGIC_OFFICE_ASSET_ROOT}/themes/${themeId}/rooms/${roomFile}`,
    fallbackSymbol: roomFallbackSymbol(normalizedRoomId),
  }
}

export function getMagicAgentAsset(avatarStyle: string | null | undefined, actionState: string | null | undefined): MagicAgentAsset {
  const normalizedAvatarStyle = avatarStyle || ''
  const folder = avatarAssetFolders[normalizedAvatarStyle] ?? toSlug(normalizedAvatarStyle, 'unknown-agent')
  const state = stateAssetMap[actionState || ''] ?? (actionState ? 'working' : 'idle')
  const assetFile = agentAssetFilesByFolder[folder]?.[state] ?? `${state}.webp`

  return {
    avatarStyle: normalizedAvatarStyle,
    folder,
    state,
    src: `${MAGIC_OFFICE_ASSET_ROOT}/agents/${folder}/${assetFile}`,
    fallbackSymbol: avatarFallbackSymbols[normalizedAvatarStyle] ?? '?',
  }
}

export function getMagicEffectAsset(actionState: string | null | undefined): MagicEffectAsset | null {
  const effect = effectAssetMap[actionState || '']
  if (!effect) return null

  return {
    effect,
    src: `${MAGIC_OFFICE_ASSET_ROOT}/effects/${effectAssetFiles[effect]}`,
  }
}
