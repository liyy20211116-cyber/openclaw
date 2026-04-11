import { useSnapshot } from '../hooks/useSnapshot'
import { taskService } from '../services/taskService'
import { auditService } from '../services/auditService'
import { treasuryService } from '../services/treasuryService'

export function StatusBar() {
  useSnapshot()

  const activeTasks = taskService.getAll().filter((t) => t.status === 'in_progress' || t.status === 'review').length
  const pendingApprovals = taskService.getAll().filter((t) => t.status === 'pending_approval').length
  const openAudits = auditService.getOpenCount()
  const treasury = treasuryService.getTreasury()

  return (
    <div className="status-bar">
      <div className="status-bar-item">
        <span className="status-bar-dot active" />
        进行中 {activeTasks}
      </div>
      <div className="status-bar-item">
        <span className="status-bar-dot pending" />
        待审批 {pendingApprovals}
      </div>
      <div className="status-bar-item">
        <span className="status-bar-dot warn" />
        审计 {openAudits}
      </div>
      <div className="status-bar-item">
        国库 {treasury.availableBalance.toLocaleString()} T
      </div>
      <div className="status-bar-item muted" style={{ marginLeft: 'auto' }}>
        Jarvis One Company OS · MVP
      </div>
    </div>
  )
}
