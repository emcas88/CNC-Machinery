import { useEffect, useRef, useState } from 'react'

interface UseAutoSaveOptions<T> {
  data: T
  saveFn: (data: T) => Promise<void>
  delay?: number
  enabled?: boolean
}

interface UseAutoSaveResult {
  isSaving: boolean
  lastSaved: Date | null
  error: Error | null
}

export function useAutoSave<T>({
  data,
  saveFn,
  delay = 2000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const isFirstRender = useRef(true)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (!enabled) return

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setIsSaving(true)
      try {
        await saveFn(data)
        setLastSaved(new Date())
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setIsSaving(false)
      }
    }, delay)

    return () => clearTimeout(timerRef.current)
  }, [data, delay, enabled, saveFn])

  return { isSaving, lastSaved, error }
}
