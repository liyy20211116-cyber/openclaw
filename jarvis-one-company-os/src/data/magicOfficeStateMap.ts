import type { RuntimeMagicCharacter, RuntimeMagicRoom } from '../services/runtimeStatusService'

export const MAGIC_OFFICE_WIDTH = 940
export const MAGIC_OFFICE_HEIGHT = 560

export type MagicStateTone = 'cyan' | 'green' | 'amber' | 'violet' | 'danger' | 'teal'
export type MagicStateAnimation = 'float' | 'pulse' | 'spark' | 'guard' | 'shake' | 'breathe'

export interface MagicStateMeta {
  label: string
  roomId: string
  animation: MagicStateAnimation
  tone: MagicStateTone
  bubble: string
  priority: number
  needsAttention: boolean
}

export interface MagicAgentPosition {
  left: string
  top: string
  roomId: string
  usesTargetRoom: boolean
}

export const magicOfficeStateMap: Record<string, MagicStateMeta> = {
  coordinating: {
    label: '经营调度',
    roomId: 'command_hall',
    animation: 'pulse',
    tone: 'cyan',
    bubble: '正在调度全局节奏',
    priority: 70,
    needsAttention: false,
  },
  writing: {
    label: '内容写作',
    roomId: 'crystal_studio',
    animation: 'spark',
    tone: 'green',
    bubble: '正在产出内容资产',
    priority: 50,
    needsAttention: false,
  },
  syncing: {
    label: '同步数据',
    roomId: 'spell_library',
    animation: 'breathe',
    tone: 'cyan',
    bubble: '正在同步运行数据',
    priority: 45,
    needsAttention: false,
  },
  lead_following: {
    label: '线索跟进',
    roomId: 'owl_station',
    animation: 'float',
    tone: 'amber',
    bubble: '正在检查线索和报价机会',
    priority: 55,
    needsAttention: false,
  },
  accounting: {
    label: '收入核算',
    roomId: 'gold_vault',
    animation: 'guard',
    tone: 'amber',
    bubble: '等待真实收款凭证',
    priority: 60,
    needsAttention: false,
  },
  guarding: {
    label: '风控守护',
    roomId: 'ward_room',
    animation: 'guard',
    tone: 'violet',
    bubble: '正在守住合规边界',
    priority: 65,
    needsAttention: false,
  },
  learning: {
    label: '复盘训练',
    roomId: 'training_room',
    animation: 'breathe',
    tone: 'green',
    bubble: '正在沉淀经验',
    priority: 40,
    needsAttention: false,
  },
  waiting_approval: {
    label: '待 CEO 审批',
    roomId: 'ceo_gate',
    animation: 'pulse',
    tone: 'amber',
    bubble: '需要 CEO 处理',
    priority: 90,
    needsAttention: true,
  },
  blocked: {
    label: '阻塞异常',
    roomId: 'ward_room',
    animation: 'shake',
    tone: 'danger',
    bubble: '存在卡点，需要排障',
    priority: 100,
    needsAttention: true,
  },
  working: {
    label: '办公中',
    roomId: 'command_hall',
    animation: 'float',
    tone: 'teal',
    bubble: '正在推进任务',
    priority: 35,
    needsAttention: false,
  },
}

const fallbackState: MagicStateMeta = {
  label: '未知状态',
  roomId: 'command_hall',
  animation: 'float',
  tone: 'teal',
  bubble: '等待下一次同步',
  priority: 10,
  needsAttention: false,
}

const offsetPattern = [
  [0, 0],
  [-24, -14],
  [24, -14],
  [-24, 18],
  [24, 18],
  [0, -30],
  [0, 32],
  [-42, 4],
  [42, 4],
]

export function getMagicStateMeta(state: string): MagicStateMeta {
  return magicOfficeStateMap[state] ?? {
    ...fallbackState,
    label: state || fallbackState.label,
  }
}

function toPercent(value: number, total: number) {
  return `${(value / total) * 100}%`
}

export function resolveMagicAgentPosition(
  character: RuntimeMagicCharacter,
  rooms: RuntimeMagicRoom[],
  roomIndex: number,
  roomCount: number,
): MagicAgentPosition {
  const targetRoomId = character.target_room_id || ''
  const targetRoom = targetRoomId ? rooms.find((room) => room.id === targetRoomId) : null

  if (!targetRoom) {
    return {
      left: toPercent(character.x, MAGIC_OFFICE_WIDTH),
      top: toPercent(character.y, MAGIC_OFFICE_HEIGHT),
      roomId: character.room_id,
      usesTargetRoom: false,
    }
  }

  const [offsetX, offsetY] = offsetPattern[roomIndex % offsetPattern.length]
  const crowdLift = roomCount > 4 ? Math.floor(roomIndex / offsetPattern.length) * 10 : 0
  const centerX = targetRoom.x + targetRoom.width / 2 + offsetX
  const centerY = targetRoom.y + targetRoom.height / 2 + offsetY + crowdLift

  return {
    left: toPercent(centerX, MAGIC_OFFICE_WIDTH),
    top: toPercent(centerY, MAGIC_OFFICE_HEIGHT),
    roomId: targetRoom.id,
    usesTargetRoom: true,
  }
}
