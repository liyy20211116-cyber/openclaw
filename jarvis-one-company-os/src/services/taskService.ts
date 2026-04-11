import { getSnapshot } from '../lib/snapshotStore'

export const taskService = {
  getAll() {
    return getSnapshot().tasks
  },
  getById(taskId: string) {
    return getSnapshot().tasks.find((task) => task.id === taskId)
  },
  getActiveCount() {
    return getSnapshot().tasks.filter((task) => ['approved', 'in_progress', 'review'].includes(task.status)).length
  },
}
