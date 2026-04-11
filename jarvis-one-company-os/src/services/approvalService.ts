import { getSnapshot } from '../lib/snapshotStore'

export const approvalService = {
  getAll() {
    return getSnapshot().approvals
  },
  getPendingCount() {
    return getSnapshot().approvals.filter((approval) => approval.status === 'pending').length
  },
}
