import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoSave } from '@/hooks/useAutoSave'

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not call saveFn immediately on mount', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAutoSave({ data: { value: 1 }, saveFn, delay: 1000 }))
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('calls saveFn after the delay when data changes', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(
      ({ data }) => useAutoSave({ data, saveFn, delay: 1000 }),
      { initialProps: { data: { value: 1 } } }
    )

    rerender({ data: { value: 2 } })

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenCalledWith({ value: 2 })
  })

  it('debounces multiple rapid data changes and only saves once', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(
      ({ data }) => useAutoSave({ data, saveFn, delay: 1000 }),
      { initialProps: { data: { value: 1 } } }
    )

    rerender({ data: { value: 2 } })
    rerender({ data: { value: 3 } })
    rerender({ data: { value: 4 } })

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenCalledWith({ value: 4 })
  })

  it('resets the debounce timer on each data change', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(
      ({ data }) => useAutoSave({ data, saveFn, delay: 1000 }),
      { initialProps: { data: { value: 1 } } }
    )

    rerender({ data: { value: 2 } })
    await act(async () => { vi.advanceTimersByTime(500) })
    rerender({ data: { value: 3 } })
    await act(async () => { vi.advanceTimersByTime(500) })

    // Only 500ms elapsed since last change, should not have fired
    expect(saveFn).not.toHaveBeenCalled()

    await act(async () => { vi.advanceTimersByTime(500) })
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('returns isSaving=false initially', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave({ data: { v: 1 }, saveFn, delay: 1000 }))
    expect(result.current.isSaving).toBe(false)
  })

  it('returns lastSaved as null before first save', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave({ data: { v: 1 }, saveFn, delay: 1000 }))
    expect(result.current.lastSaved).toBeNull()
  })

  it('updates lastSaved after a successful save', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave({ data, saveFn, delay: 500 }),
      { initialProps: { data: { v: 1 } } }
    )

    rerender({ data: { v: 2 } })
    await act(async () => { vi.advanceTimersByTime(500) })
    await act(async () => Promise.resolve())

    expect(result.current.lastSaved).not.toBeNull()
    expect(result.current.lastSaved).toBeInstanceOf(Date)
  })

  it('does not call saveFn if enabled=false', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(
      ({ data }) => useAutoSave({ data, saveFn, delay: 500, enabled: false }),
      { initialProps: { data: { v: 1 } } }
    )

    rerender({ data: { v: 2 } })
    await act(async () => { vi.advanceTimersByTime(500) })

    expect(saveFn).not.toHaveBeenCalled()
  })
})
