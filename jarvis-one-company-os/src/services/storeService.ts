import { getSnapshot } from '../lib/snapshotStore'

export const storeService = {
  getAllItems() {
    return getSnapshot().storeItems ?? []
  },
  getEnabledItems() {
    return (getSnapshot().storeItems ?? []).filter((item) => item.enabled)
  },
  getAllOrders() {
    return getSnapshot().storeOrders ?? []
  },
  getOrdersByAgent(agentId: string) {
    return (getSnapshot().storeOrders ?? []).filter((order) => order.buyerAgentId === agentId)
  },
}
