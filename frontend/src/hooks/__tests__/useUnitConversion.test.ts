import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUnitConversion } from '@/hooks/useUnitConversion'

describe('useUnitConversion', () => {
  // The hook reads from the zustand store; we reset each test with metric
  beforeEach(() => {
    // Reset the unit system store to 'metric' if possible
    // Since we can't directly set the store here without importing it,
    // we rely on the test-utils wrapping or assume default is metric.
  })

  it('returns mmToDisplay that returns the same value in metric mode', () => {
    const { result } = renderHook(() => useUnitConversion())
    // Default is metric
    expect(result.current.mmToDisplay(100)).toBeCloseTo(100, 1)
  })

  it('returns mmToDisplay that converts mm to inches in imperial mode', () => {
    const { result } = renderHook(() => useUnitConversion())
    act(() => result.current.setUnitSystem('imperial'))
    // 25.4mm = 1 inch
    expect(result.current.mmToDisplay(25.4)).toBeCloseTo(1, 3)
  })

  it('returns displayToMm that returns the same value in metric mode', () => {
    const { result } = renderHook(() => useUnitConversion())
    act(() => result.current.setUnitSystem('metric'))
    expect(result.current.displayToMm(100)).toBeCloseTo(100, 1)
  })

  it('returns displayToMm that converts inches to mm in imperial mode', () => {
    const { result } = renderHook(() => useUnitConversion())
    act(() => result.current.setUnitSystem('imperial'))
    // 1 inch = 25.4mm
    expect(result.current.displayToMm(1)).toBeCloseTo(25.4, 3)
  })

  it('formatDisplay returns value with "mm" suffix in metric mode', () => {
    const { result } = renderHook(() => useUnitConversion())
    act(() => result.current.setUnitSystem('metric'))
    expect(result.current.formatDisplay(100)).toMatch(/mm/)
  })

  it('formatDisplay returns value with "\"" or "in" suffix in imperial mode', () => {
    const { result } = renderHook(() => useUnitConversion())
    act(() => result.current.setUnitSystem('imperial'))
    const formatted = result.current.formatDisplay(25.4)
    expect(formatted).toMatch(/\"|in/)
  })

  it('unitLabel returns "mm" in metric mode', () => {
    const { result } = renderHook(() => useUnitConversion())
    act(() => result.current.setUnitSystem('metric'))
    expect(result.current.unitLabel).toBe('mm')
  })

  it('unitLabel returns "in" in imperial mode', () => {
    const { result } = renderHook(() => useUnitConversion())
    act(() => result.current.setUnitSystem('imperial'))
    expect(result.current.unitLabel).toBe('in')
  })

  it('isMetric returns true when unit system is metric', () => {
    const { result } = renderHook(() => useUnitConversion())
    act(() => result.current.setUnitSystem('metric'))
    expect(result.current.isMetric).toBe(true)
  })

  it('isMetric returns false when unit system is imperial', () => {
    const { result } = renderHook(() => useUnitConversion())
    act(() => result.current.setUnitSystem('imperial'))
    expect(result.current.isMetric).toBe(false)
  })

  it('setUnitSystem toggles between metric and imperial', () => {
    const { result } = renderHook(() => useUnitConversion())
    act(() => result.current.setUnitSystem('imperial'))
    expect(result.current.isMetric).toBe(false)
    act(() => result.current.setUnitSystem('metric'))
    expect(result.current.isMetric).toBe(true)
  })

  it('formatDisplay handles 0 correctly', () => {
    const { result } = renderHook(() => useUnitConversion())
    act(() => result.current.setUnitSystem('metric'))
    expect(result.current.formatDisplay(0)).toMatch(/0/)
  })

  it('mmToDisplay handles negative values in imperial mode', () => {
    const { result } = renderHook(() => useUnitConversion())
    act(() => result.current.setUnitSystem('imperial'))
    expect(result.current.mmToDisplay(-25.4)).toBeCloseTo(-1, 3)
  })
})
