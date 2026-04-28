import assert from 'node:assert/strict'
import test from 'node:test'
import { createNotificationStore } from '../lib/session-notifications'

test('notification store clears timers during rapid dismiss and unmount', () => {
  let nextTimerId = 1
  const activeTimers = new Set<number>()
  const store = createNotificationStore({
    setTimer: () => {
      const id = nextTimerId++
      activeTimers.add(id)
      return id
    },
    clearTimer: (id) => {
      activeTimers.delete(id as number)
    },
  })

  const ids = Array.from({ length: 50 }, (_, idx) =>
    store.enqueue({ type: idx % 2 === 0 ? 'info' : 'error', message: `Notice ${idx}` }),
  )

  ids.forEach((id, idx) => {
    if (idx % 3 === 0) store.dismiss(id)
  })
  store.clearAll()

  assert.equal(activeTimers.size, 0)
  assert.deepStrictEqual(store.list(), [])
})
