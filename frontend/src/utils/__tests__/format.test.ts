import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDate,
  formatRelativeTime,
  pluralise,
  truncate,
  formatFileSize,
  toTitleCase,
} from '@/utils/format'

describe('formatNumber', () => {
  it('formats 0 with 2 decimal places', () => {
    expect(formatNumber(0)).toBe('0.00')
  })

  it('formats with thousands separators', () => {
    // en-AU locale uses comma as thousands separator
    expect(formatNumber(1234.56)).toBe('1,234.56')
  })

  it('formats negative numbers', () => {
    expect(formatNumber(-99.1)).toBe('-99.10')
  })

  it('formats large numbers', () => {
    expect(formatNumber(1000000)).toBe('1,000,000.00')
  })

  it('respects custom decimals', () => {
    expect(formatNumber(1.5, 0)).toBe('2')
  })
})

describe('formatCurrency', () => {
  it('formats 0 as AUD', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0.00')
  })

  it('formats 99.99 as AUD', () => {
    const result = formatCurrency(99.99)
    expect(result).toContain('99.99')
  })

  it('formats 1234.56 as AUD', () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain('1,234.56')
  })

  it('uses AUD as default currency', () => {
    const result = formatCurrency(10)
    expect(result).toContain('10.00')
    expect(result).toContain('$')
  })

  it('supports USD currency', () => {
    const result = formatCurrency(10, 'USD')
    expect(result).toBeTruthy()
    expect(result).toContain('10.00')
  })
})

describe('formatPercent', () => {
  it('formats 0%', () => {
    expect(formatPercent(0)).toBe('0.0%')
  })

  it('formats 50.0%', () => {
    expect(formatPercent(50.0)).toBe('50.0%')
  })

  it('formats 99.9%', () => {
    expect(formatPercent(99.9)).toBe('99.9%')
  })

  it('formats 100%', () => {
    expect(formatPercent(100)).toBe('100.0%')
  })

  it('formats with custom decimals', () => {
    expect(formatPercent(33.333, 2)).toBe('33.33%')
  })
})

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    const result = formatDate('2026-01-15T10:00:00Z')
    expect(result).toBeTruthy()
    // en-AU format is DD Mon YYYY
    expect(result).toContain('2026')
    expect(result).toContain('Jan')
  })

  it('formats another ISO date', () => {
    const result = formatDate('2025-12-25T00:00:00Z')
    expect(result).toContain('2025')
    expect(result).toContain('Dec')
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for timestamps within the last minute', () => {
    const recent = new Date('2026-03-01T11:59:30Z').toISOString()
    expect(formatRelativeTime(recent)).toBe('just now')
  })

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date('2026-03-01T11:55:00Z').toISOString()
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago')
  })

  it('returns hours ago', () => {
    const threeHoursAgo = new Date('2026-03-01T09:00:00Z').toISOString()
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago')
  })

  it('returns days ago', () => {
    const twoDaysAgo = new Date('2026-02-27T12:00:00Z').toISOString()
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago')
  })

  it('returns "just now" for exactly now', () => {
    const now = new Date('2026-03-01T12:00:00Z').toISOString()
    expect(formatRelativeTime(now)).toBe('just now')
  })
})

describe('pluralise', () => {
  it('returns "0 items" for count 0', () => {
    expect(pluralise(0, 'item')).toBe('0 items')
  })

  it('returns "1 item" for count 1 (singular)', () => {
    expect(pluralise(1, 'item')).toBe('1 item')
  })

  it('returns "2 items" for count 2', () => {
    expect(pluralise(2, 'item')).toBe('2 items')
  })

  it('uses custom plural when provided', () => {
    expect(pluralise(2, 'person', 'people')).toBe('2 people')
  })

  it('uses custom plural for 0 count', () => {
    expect(pluralise(0, 'person', 'people')).toBe('0 people')
  })

  it('uses singular for count 1 with custom plural', () => {
    expect(pluralise(1, 'person', 'people')).toBe('1 person')
  })
})

describe('truncate', () => {
  it('does not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('does not truncate string at exact length', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })

  it('truncates string longer than maxLength with ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello…')
  })

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('')
  })
})

describe('formatFileSize', () => {
  it('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('formats KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
  })

  it('formats MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
  })

  it('formats GB', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB')
  })

  it('formats decimal KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })
})

describe('toTitleCase', () => {
  it('converts lowercase to title case', () => {
    expect(toTitleCase('hello world')).toBe('Hello World')
  })

  it('converts uppercase to title case', () => {
    expect(toTitleCase('HELLO WORLD')).toBe('Hello World')
  })

  it('handles single word', () => {
    expect(toTitleCase('hello')).toBe('Hello')
  })

  it('handles empty string', () => {
    expect(toTitleCase('')).toBe('')
  })

  it('handles already title case', () => {
    expect(toTitleCase('Hello World')).toBe('Hello World')
  })
})
