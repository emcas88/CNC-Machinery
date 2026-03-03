// ── Core converters ─────────────────────────────────────────────────

export const mmToInches = (mm: number): number => mm / 25.4
export const inchesToMm = (inches: number): number => inches * 25.4
export const boardFeetToCubicMm = (bf: number): number => bf * 2359737.22
export const sqMmToSqFt = (sqMm: number): number => sqMm / 92903.04
export const sqMmToSqM = (sqMm: number): number => sqMm / 1_000_000

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

export const roundTo = (value: number, step: number): number =>
  Math.round(value / step) * step

// ── Unit type ───────────────────────────────────────────────────────

export type UnitType = 'mm' | 'cm' | 'in' | 'ft'

// ── Generic unit conversion ─────────────────────────────────────────

const toMm: Record<UnitType, (v: number) => number> = {
  mm: (v) => v,
  cm: (v) => v * 10,
  in: (v) => v * 25.4,
  ft: (v) => v * 304.8,
}

const fromMm: Record<UnitType, (v: number) => number> = {
  mm: (v) => v,
  cm: (v) => v / 10,
  in: (v) => v / 25.4,
  ft: (v) => v / 304.8,
}

export function convertUnit(value: number, from: UnitType, to: UnitType): number {
  return fromMm[to](toMm[from](value))
}

// ── Parse / format ──────────────────────────────────────────────────

interface ParsedUnit {
  value: number
  unit: UnitType
}

const UNIT_RE = /^\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|in|ft|"|')?\s*$/

export function parseUnit(input: string): ParsedUnit | null {
  const m = UNIT_RE.exec(input)
  if (!m) return null
  const value = parseFloat(m[1])
  const raw = m[2]
  let unit: UnitType = 'mm'
  if (raw === 'cm') unit = 'cm'
  else if (raw === 'in' || raw === '"') unit = 'in'
  else if (raw === 'ft' || raw === "'") unit = 'ft'
  return { value, unit }
}

export function formatUnit(value: number, unit: UnitType): string {
  switch (unit) {
    case 'mm': return `${value.toFixed(1)} mm`
    case 'cm': return `${value.toFixed(1)} cm`
    case 'in': return `${value.toFixed(3)}"`
    case 'ft': return `${value.toFixed(3)}'`
  }
}

// ── Dimension (WxH) helpers ─────────────────────────────────────────

export function formatDimension(width: number, height: number, unit: UnitType = 'mm'): string {
  switch (unit) {
    case 'mm': return `${width.toFixed(1)} x ${height.toFixed(1)} mm`
    case 'cm': return `${width.toFixed(1)} x ${height.toFixed(1)} cm`
    case 'in': return `${convertUnit(width, 'mm', 'in').toFixed(3)} x ${convertUnit(height, 'mm', 'in').toFixed(3)}"`
    case 'ft': return `${convertUnit(width, 'mm', 'ft').toFixed(3)} x ${convertUnit(height, 'mm', 'ft').toFixed(3)}'`
  }
}

interface ParsedDimension {
  width: number
  height: number
  unit: UnitType
}

const DIM_RE = /^\s*(-?\d+(?:\.\d+)?)\s*(?:mm|cm|in|ft)?\s*[xX×]\s*(-?\d+(?:\.\d+)?)\s*(?:mm|cm|in|ft)?\s*$/

export function parseDimension(input: string): ParsedDimension | null {
  const m = DIM_RE.exec(input)
  if (!m) return null
  return { width: parseFloat(m[1]), height: parseFloat(m[2]), unit: 'mm' }
}
