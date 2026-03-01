import { describe, it, expect } from 'vitest'
import {
  parseUnit,
  formatUnit,
  convertUnit,
  formatDimension,
  parseDimension,
} from '@/utils/units'

describe('parseUnit', () => {
  it('parses plain number as mm', () => {
    expect(parseUnit('100')).toEqual({ value: 100, unit: 'mm' })
  })

  it('parses mm string', () => {
    expect(parseUnit('100mm')).toEqual({ value: 100, unit: 'mm' })
  })

  it('parses mm with space', () => {
    expect(parseUnit('100 mm')).toEqual({ value: 100, unit: 'mm' })
  })

  it('parses cm string', () => {
    expect(parseUnit('10cm')).toEqual({ value: 10, unit: 'cm' })
  })

  it('parses inch string (in)', () => {
    expect(parseUnit('4in')).toEqual({ value: 4, unit: 'in' })
  })

  it('parses inch string (")', () => {
    expect(parseUnit('4"')).toEqual({ value: 4, unit: 'in' })
  })

  it('parses feet string (ft)', () => {
    expect(parseUnit("2ft")).toEqual({ value: 2, unit: 'ft' })
  })

  it('parses feet string (\')', () => {
    expect(parseUnit("2'")).toEqual({ value: 2, unit: 'ft' })
  })

  it('returns null for invalid input', () => {
    expect(parseUnit('abc')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseUnit('')).toBeNull()
  })
})

describe('formatUnit', () => {
  it('formats mm with 1 decimal', () => {
    expect(formatUnit(100, 'mm')).toBe('100.0 mm')
  })

  it('formats cm with 1 decimal', () => {
    expect(formatUnit(10, 'cm')).toBe('10.0 cm')
  })

  it('formats inches with 3 decimals', () => {
    expect(formatUnit(4, 'in')).toBe('4.000"')
  })

  it('formats feet with 3 decimals', () => {
    expect(formatUnit(2, 'ft')).toBe("2.000'")
  })

  it('formats fractional mm', () => {
    expect(formatUnit(100.5, 'mm')).toBe('100.5 mm')
  })
})

describe('convertUnit', () => {
  it('converts mm to mm (identity)', () => {
    expect(convertUnit(100, 'mm', 'mm')).toBe(100)
  })

  it('converts mm to cm', () => {
    expect(convertUnit(100, 'mm', 'cm')).toBeCloseTo(10, 5)
  })

  it('converts mm to inches', () => {
    expect(convertUnit(25.4, 'mm', 'in')).toBeCloseTo(1, 5)
  })

  it('converts mm to feet', () => {
    expect(convertUnit(304.8, 'mm', 'ft')).toBeCloseTo(1, 5)
  })

  it('converts inches to mm', () => {
    expect(convertUnit(1, 'in', 'mm')).toBeCloseTo(25.4, 5)
  })

  it('converts feet to mm', () => {
    expect(convertUnit(1, 'ft', 'mm')).toBeCloseTo(304.8, 5)
  })

  it('converts cm to mm', () => {
    expect(convertUnit(10, 'cm', 'mm')).toBeCloseTo(100, 5)
  })
})

describe('formatDimension', () => {
  it('formats WxH with mm units', () => {
    expect(formatDimension(600, 720, 'mm')).toBe('600.0 x 720.0 mm')
  })

  it('formats WxH with inch units', () => {
    const result = formatDimension(25.4, 50.8, 'in')
    expect(result).toContain('1.000')
    expect(result).toContain('2.000')
  })

  it('formats WxH with default mm units', () => {
    expect(formatDimension(300, 600)).toBe('300.0 x 600.0 mm')
  })
})

describe('parseDimension', () => {
  it('parses WxH in mm', () => {
    const result = parseDimension('600x720')
    expect(result).not.toBeNull()
    expect(result!.width).toBe(600)
    expect(result!.height).toBe(720)
    expect(result!.unit).toBe('mm')
  })

  it('parses WxH with units', () => {
    const result = parseDimension('600mm x 720mm')
    expect(result).not.toBeNull()
    expect(result!.width).toBe(600)
    expect(result!.height).toBe(720)
  })

  it('parses W x H with spaces', () => {
    const result = parseDimension('600 x 720')
    expect(result).not.toBeNull()
    expect(result!.width).toBe(600)
    expect(result!.height).toBe(720)
  })

  it('returns null for invalid input', () => {
    expect(parseDimension('abc')).toBeNull()
  })

  it('returns null for single dimension', () => {
    expect(parseDimension('600')).toBeNull()
  })
})
