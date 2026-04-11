import { getSnapshot } from '../lib/snapshotStore'

export const revenueService = {
  getAll() {
    return getSnapshot().revenues
  },
  getTotalRevenue() {
    return getSnapshot().revenues.reduce((sum, item) => sum + item.amount, 0)
  },
}
