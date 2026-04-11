import { getSnapshot } from '../lib/snapshotStore'

export const ledgerService = {
  getAll() {
    return getSnapshot().ledger
  },
  getTotalWalletBalance() {
    return getSnapshot().agents.reduce((sum, agent) => sum + agent.walletBalance, 0)
  },
  getWeeklySpend() {
    return Math.abs(getSnapshot().ledger.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0))
  },
}
