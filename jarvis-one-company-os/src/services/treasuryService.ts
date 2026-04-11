import { getSnapshot } from '../lib/snapshotStore'

export const treasuryService = {
  getTreasury() {
    return getSnapshot().treasury ?? { totalBalance: 0, reservedBalance: 0, availableBalance: 0 }
  },
}
