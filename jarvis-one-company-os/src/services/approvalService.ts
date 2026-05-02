import { getSnapshot } from '../lib/snapshotStore'
import { approvalBridgeService } from './approvalBridgeService'

export const approvalService = {
  getAll() {
    return getSnapshot().approvals
  },
  getPendingCount() {
    return approvalBridgeService.listUnifiedApprovals().filter((approval) => approval.status === 'pending').length
  },
}
