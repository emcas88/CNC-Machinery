import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUndoRedo } from '@/hooks/useUndoRedo'

describe('useUndoRedo', () => {
  it('initializes with the provided initial state', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    expect(result.current.state).toEqual({ count: 0 })
  })

  it('canUndo is false initially', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    expect(result.current.canUndo).toBe(false)
  })

  it('canRedo is false initially', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    expect(result.current.canRedo).toBe(false)
  })

  it('updates the state when setState is called', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    act(() => result.current.setState({ count: 1 }))
    expect(result.current.state).toEqual({ count: 1 })
  })

  it('canUndo becomes true after setState', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    act(() => result.current.setState({ count: 1 }))
    expect(result.current.canUndo).toBe(true)
  })

  it('undoes the last setState', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    act(() => result.current.setState({ count: 1 }))
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 0 })
  })

  it('canRedo becomes true after undo', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    act(() => result.current.setState({ count: 1 }))
    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)
  })

  it('redoes the last undone action', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    act(() => result.current.setState({ count: 1 }))
    act(() => result.current.undo())
    act(() => result.current.redo())
    expect(result.current.state).toEqual({ count: 1 })
  })

  it('canUndo is false after undoing all actions', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    act(() => result.current.setState({ count: 1 }))
    act(() => result.current.undo())
    expect(result.current.canUndo).toBe(false)
  })

  it('canRedo is false after redoing all actions', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    act(() => result.current.setState({ count: 1 }))
    act(() => result.current.undo())
    act(() => result.current.redo())
    expect(result.current.canRedo).toBe(false)
  })

  it('clears the redo stack when a new setState is called after undo', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    act(() => result.current.setState({ count: 1 }))
    act(() => result.current.setState({ count: 2 }))
    act(() => result.current.undo())
    // Now branch off
    act(() => result.current.setState({ count: 99 }))
    expect(result.current.canRedo).toBe(false)
    expect(result.current.state).toEqual({ count: 99 })
  })

  it('handles multiple sequential undos', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    act(() => result.current.setState({ count: 1 }))
    act(() => result.current.setState({ count: 2 }))
    act(() => result.current.setState({ count: 3 }))
    act(() => result.current.undo())
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 1 })
  })

  it('handles multiple sequential redos', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    act(() => result.current.setState({ count: 1 }))
    act(() => result.current.setState({ count: 2 }))
    act(() => result.current.setState({ count: 3 }))
    act(() => result.current.undo())
    act(() => result.current.undo())
    act(() => result.current.redo())
    act(() => result.current.redo())
    expect(result.current.state).toEqual({ count: 3 })
  })

  it('undo does nothing when canUndo is false', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 0 })
  })

  it('redo does nothing when canRedo is false', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    act(() => result.current.redo())
    expect(result.current.state).toEqual({ count: 0 })
  })

  it('respects the maxHistory limit', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }, { maxHistory: 3 }))
    act(() => result.current.setState({ count: 1 }))
    act(() => result.current.setState({ count: 2 }))
    act(() => result.current.setState({ count: 3 }))
    act(() => result.current.setState({ count: 4 })) // This should evict the first entry

    // Undo 3 times (max 3 history)
    act(() => result.current.undo())
    act(() => result.current.undo())
    act(() => result.current.undo())

    // Should be at count=1 (not count=0 since that was evicted)
    expect(result.current.state).toEqual({ count: 1 })
    expect(result.current.canUndo).toBe(false)
  })

  it('reset clears history and sets state back to initial value', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }))
    act(() => result.current.setState({ count: 5 }))
    act(() => result.current.reset())
    expect(result.current.state).toEqual({ count: 0 })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })
})
