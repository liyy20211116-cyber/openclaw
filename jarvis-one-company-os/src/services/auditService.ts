import { getSnapshot } from '../lib/snapshotStore'

export const auditService = {
  getAll() {
    return getSnapshot().auditEvents ?? []
  },
  getOpenEvents() {
    return (getSnapshot().auditEvents ?? []).filter((event) => event.status === 'open' || event.status === 'reviewing')
  },
  getOpenCount() {
    return this.getOpenEvents().length
  },
}
