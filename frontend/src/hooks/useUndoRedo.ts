import { useCallback, useRef, useState } from 'react'

interface UseUndoRedoOptions {
  maxHistory?: number
}

interface UseUndoRedoResult<T> {
  state: T
  setState: (newState: T) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  reset: () => void
}

export function useUndoRedo<T>(initialState: T, options: UseUndoRedoOptions = {}): UseUndoRedoResult<T> {
  const { maxHistory = 100 } = options
  const [state, setStateInternal] = useState<T>(initialState)
  const past = useRef<T[]>([])
  const future = useRef<T[]>([])
  const initialRef = useRef<T>(initialState)

  const setState = useCallback(
    (newState: T) => {
      past.current = [...past.current.slice(-(maxHistory - 1)), state]
      future.current = []
      setStateInternal(newState)
    },
    [maxHistory, state]
  )

  const undo = useCallback(() => {
    if (past.current.length === 0) return
    const prev = past.current[past.current.length - 1]
    past.current = past.current.slice(0, -1)
    future.current = [state, ...future.current]
    setStateInternal(prev)
  }, [state])

  const redo = useCallback(() => {
    if (future.current.length === 0) return
    const next = future.current[0]
    future.current = future.current.slice(1)
    past.current = [...past.current, state]
    setStateInternal(next)
  }, [state])

  const reset = useCallback(() => {
    past.current = []
    future.current = []
    setStateInternal(initialRef.current)
  }, [])

  return {
    state,
    setState,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    reset,
  }
}
