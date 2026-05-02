import { useNavigate } from 'react-router'
import type { RuntimeMagicCharacter, RuntimeMagicRoom } from '../../services/runtimeStatusService'
import { getMagicStateMeta } from '../../data/magicOfficeStateMap'

type MagicAgentPanelProps = {
  selectedAgent: RuntimeMagicCharacter | null
  rooms: RuntimeMagicRoom[]
  safeNote: string
}

function roomName(rooms: RuntimeMagicRoom[], roomId: string) {
  return rooms.find((room) => room.id === roomId)?.name ?? (roomId || '未确认')
}

export function MagicAgentPanel({ selectedAgent, rooms, safeNote }: MagicAgentPanelProps) {
  const navigate = useNavigate()

  if (!selectedAgent) {
    return (
      <aside className="panel magic-side-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">角色状态</p>
            <h3>选择一个 Agent</h3>
          </div>
        </div>
        <p className="muted">{safeNote || '点击场景中的魔法员工，查看当前任务、房间和审批状态。'}</p>
      </aside>
    )
  }

  const meta = getMagicStateMeta(selectedAgent.action_state)

  return (
    <aside className="panel magic-side-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">角色状态</p>
          <h3>{selectedAgent.display_name}</h3>
        </div>
        <span className={`status-pill ${meta.needsAttention || selectedAgent.needs_ceo_review ? 'review' : 'idle'}`}>
          {meta.label}
        </span>
      </div>

      <div className="stack-list">
        <div className="stack-item magic-detail-item">
          <strong>当前位置</strong>
          <p>{roomName(rooms, selectedAgent.room_id)}</p>
        </div>
        <div className="stack-item magic-detail-item">
          <strong>目标房间</strong>
          <p>{roomName(rooms, selectedAgent.target_room_id)}</p>
        </div>
        <div className="stack-item magic-detail-item">
          <strong>当前任务</strong>
          <p>{selectedAgent.current_task || '暂无任务信息'}</p>
        </div>
        <div className="stack-item magic-detail-item">
          <strong>最近动作</strong>
          <p>{selectedAgent.last_action || '等待下一次同步'}</p>
        </div>
        <div className="stack-item magic-detail-item">
          <strong>现场气泡</strong>
          <p>{selectedAgent.speech || meta.bubble}</p>
        </div>
        <div className="stack-item magic-detail-item">
          <strong>CEO 审批</strong>
          <p>{selectedAgent.needs_ceo_review ? '需要 CEO 处理' : '当前不需要审批'}</p>
        </div>
      </div>

      <div className="magic-panel-actions">
        {selectedAgent.needs_ceo_review && (
          <button type="button" onClick={() => navigate('/approvals')}>
            前往审批中心
          </button>
        )}
        {selectedAgent.current_task && (
          <button type="button" className="secondary" onClick={() => navigate('/tasks')}>
            查看任务看板
          </button>
        )}
      </div>
    </aside>
  )
}
