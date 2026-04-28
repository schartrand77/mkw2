export type NoticeType = 'success' | 'error' | 'info'
export type Notice = { id: string; type: NoticeType; title?: string; message: string; timeout?: number }

type TimerId = unknown

type NotificationStoreOptions = {
  setTimer?: (callback: () => void, delay: number) => TimerId
  clearTimer?: (timer: TimerId) => void
  makeId?: () => string
  onChange?: (items: Notice[]) => void
}

function rndId() {
  return Math.random().toString(36).slice(2)
}

export function createNotificationStore(options: NotificationStoreOptions = {}) {
  const setTimer = options.setTimer ?? ((callback, delay) => setTimeout(callback, delay))
  const clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>))
  const makeId = options.makeId ?? rndId
  const timers = new Map<string, TimerId>()
  let items: Notice[] = []

  const emit = () => options.onChange?.([...items])

  const dismiss = (id: string) => {
    items = items.filter((item) => item.id !== id)
    const timer = timers.get(id)
    if (timer) {
      clearTimer(timer)
      timers.delete(id)
    }
    emit()
  }

  const enqueue = (noticeInput: Omit<Notice, 'id'>) => {
    const id = makeId()
    const notice: Notice = { id, ...noticeInput }
    items = [...items, notice]
    timers.set(
      id,
      setTimer(() => dismiss(id), noticeInput.timeout ?? (noticeInput.type === 'error' ? 8000 : 4000)),
    )
    emit()
    return id
  }

  const clearAll = () => {
    timers.forEach((timer) => clearTimer(timer))
    timers.clear()
    items = []
    emit()
  }

  return {
    dismiss,
    enqueue,
    clearAll,
    list: () => [...items],
  }
}
