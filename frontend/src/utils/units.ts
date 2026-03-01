/** Convert millimetres to inches */
export const mmToInches = (mm: number): number => mm / 25.4

/** Convert inches to millimetres */
export const inchesToMm = (inches: number): number => inches * 25.4

/** Convert board feet to cubic mm */
export const boardFeetToCubicMm = (bf: number): number => bf * 2359737.22

/** Convert sq mm to sq ft */
export const sqMmToSqFt = (sqMm: number): number => sqMm / 92903.04

/** Convert sq mm to sq metres */
export const sqMmToSqM = (sqMm: number): number => sqMm / 1_000_000

/** Convert mm value to a fractional inches string */
export const mmToFractionString = (mm: number): string => {
  const inches = mmToInches(mm)
  const whole = Math.floor(Math.abs(inches))
  const sign = inches < 0 ? '-' : ''
  const frac = Math.abs(inches) - whole
  if (frac < 0.0001) return `${sign}${whole}"`
  const denominators = [2, 4, 8, 16, 32, 64]
  for (const d of denominators) {
    const num = Math.round(frac * d)
    if (Math.abs(num / d - frac) < 0.002) {
      if (num === d) return `${sign}${whole + 1}"`
      return whole > 0 ? `${sign}${whole} ${num}/${d}"` : `${sign}${num}/${d}"`
    }
  }
  return `${sign}${inches.toFixed(3)}"`
}

/** Round to nearest value (e.g. 0.5 for half-mm) */
export const roundTo = (value: number, step: number): number =>
  Math.round(value / step) * step

/** Format dimension with unit */
export const formatDimension = (mm: number, unit: 'metric' | 'imperial', decimals = 1): string => {
  if (unit === 'imperial') {
    return mmToFractionString(mm)
  }
  return `${mm.toFixed(decimals)}mm`
}
