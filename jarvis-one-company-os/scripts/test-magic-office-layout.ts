import assert from 'node:assert/strict'
import {
  getMagicStateMeta,
  resolveMagicAgentPosition,
} from '../src/data/magicOfficeStateMap'
import type { RuntimeMagicCharacter, RuntimeMagicRoom } from '../src/services/runtimeStatusService'

const rooms: RuntimeMagicRoom[] = [
  {
    id: 'source_room',
    name: 'Source',
    purpose: '',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    accent: '#38bdf8',
  },
  {
    id: 'target_room',
    name: 'Target',
    purpose: '',
    x: 200,
    y: 120,
    width: 160,
    height: 100,
    accent: '#f59e0b',
  },
]

const character: RuntimeMagicCharacter = {
  agent_id: 'agent-a',
  display_name: 'Agent A',
  avatar_style: 'arcane_coo',
  room_id: 'source_room',
  target_room_id: 'target_room',
  x: 12,
  y: 24,
  action_state: 'waiting_approval',
  speech: 'Need review',
  current_task: 'Review content',
  last_action: 'Requested approval',
  needs_ceo_review: true,
}

const waiting = getMagicStateMeta('waiting_approval')
assert.equal(waiting.label, '待 CEO 审批')
assert.equal(waiting.needsAttention, true)

const blocked = getMagicStateMeta('blocked')
assert.equal(blocked.tone, 'danger')
assert.equal(blocked.needsAttention, true)

const firstTargetPosition = resolveMagicAgentPosition(character, rooms, 0, 3)
const secondTargetPosition = resolveMagicAgentPosition({ ...character, agent_id: 'agent-b' }, rooms, 1, 3)

assert.notEqual(firstTargetPosition.left, `${(character.x / 940) * 100}%`)
assert.equal(firstTargetPosition.roomId, 'target_room')
assert.notEqual(firstTargetPosition.left, secondTargetPosition.left)
assert.notEqual(firstTargetPosition.top, secondTargetPosition.top)

const fallbackPosition = resolveMagicAgentPosition(
  { ...character, target_room_id: '' },
  rooms,
  0,
  1,
)

assert.equal(fallbackPosition.roomId, 'source_room')
assert.equal(fallbackPosition.left, `${(character.x / 940) * 100}%`)
assert.equal(fallbackPosition.top, `${(character.y / 560) * 100}%`)

console.log('magic office layout tests passed')
