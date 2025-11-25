import { useRef, useCallback, useEffect } from 'react'

interface BatcherOptions {
  maxBatchSize?: number
  maxWaitMs?: number
}

// Batches messages and syncs with display refresh for smooth rendering
// Reduces re-renders from 50/sec to ~60/sec max
export function useMessageBatcher<T>(
  onFlush: (messages: T[]) => void,
  options: BatcherOptions = {}
) {
  const { maxBatchSize = 50, maxWaitMs = 16 } = options

  const bufferRef = useRef<T[]>([])
  const rafIdRef = useRef<number | null>(null)
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null)

  const flush = useCallback(() => {
    if (bufferRef.current.length === 0) return

    const batch = bufferRef.current
    bufferRef.current = []
    rafIdRef.current = null

    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current)
      timeoutIdRef.current = null
    }

    onFlush(batch)
  }, [onFlush])

  const scheduleFlush = useCallback(() => {
    if (rafIdRef.current !== null) return

    rafIdRef.current = requestAnimationFrame(() => {
      flush()
    })

    if (!timeoutIdRef.current) {
      timeoutIdRef.current = setTimeout(() => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
        flush()
      }, maxWaitMs * 2)
    }
  }, [flush, maxWaitMs])

  const addMessage = useCallback((message: T) => {
    bufferRef.current.push(message)

    if (bufferRef.current.length >= maxBatchSize) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
      flush()
    } else {
      scheduleFlush()
    }
  }, [maxBatchSize, flush, scheduleFlush])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && bufferRef.current.length > 0) {
        flush()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [flush])

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }
      if (bufferRef.current.length > 0) {
        onFlush(bufferRef.current)
      }
    }
  }, [onFlush])

  return addMessage
}
