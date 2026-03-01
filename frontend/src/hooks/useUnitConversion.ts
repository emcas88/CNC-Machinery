import { useCallback } from 'react'
import { useAppStore } from '@/store'

const MM_PER_INCH = 25.4

export function useUnitConversion() {
  const unitSystem = useAppStore((s) => s.unitSystem)
  const setUnitSystem = useAppStore((s) => s.setUnitSystem)

  const mmToDisplay = useCallback(
    (mm: number): number => {
      return unitSystem === 'imperial' ? mm / MM_PER_INCH : mm
    },
    [unitSystem]
  )

  const displayToMm = useCallback(
    (display: number): number => {
      return unitSystem === 'imperial' ? display * MM_PER_INCH : display
    },
    [unitSystem]
  )

  const formatDisplay = useCallback(
    (mm: number, decimals = 1): string => {
      const val = mmToDisplay(mm)
      return unitSystem === 'imperial'
        ? `${val.toFixed(decimals)}"`
        : `${val.toFixed(decimals)}mm`
    },
    [mmToDisplay, unitSystem]
  )

  return {
    unitSystem,
    setUnitSystem,
    mmToDisplay,
    displayToMm,
    formatDisplay,
    unitLabel: unitSystem === 'imperial' ? 'in' : 'mm',
    isMetric: unitSystem === 'metric',
  }
}
