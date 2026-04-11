import { useSyncExternalStore } from 'react'
import { getSnapshot, subscribeSnapshot } from '../lib/snapshotStore'

export function useSnapshot() {
  return useSyncExternalStore(subscribeSnapshot, getSnapshot, getSnapshot)
}
