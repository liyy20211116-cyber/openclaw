import { getSnapshot } from '../lib/snapshotStore'

export const agentService = {
  getAll() {
    return getSnapshot().agents
  },
}
