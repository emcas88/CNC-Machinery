import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as cutlistsService from '@/services/cutlists'

describe('cutlists service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a getCutlists function', () => {
    expect(typeof cutlistsService.getCutlists).toBe('function')
  })

  it('exports a getCutlistById function', () => {
    expect(typeof cutlistsService.getCutlistById).toBe('function')
  })

  it('exports a createCutlist function', () => {
    expect(typeof cutlistsService.createCutlist).toBe('function')
  })

  it('exports an updateCutlist function', () => {
    expect(typeof cutlistsService.updateCutlist).toBe('function')
  })

  it('exports a deleteCutlist function', () => {
    expect(typeof cutlistsService.deleteCutlist).toBe('function')
  })

  it('getCutlists returns a promise', () => {
    vi.spyOn(cutlistsService, 'getCutlists').mockResolvedValue([])
    const result = cutlistsService.getCutlists()
    expect(result).toBeInstanceOf(Promise)
  })

  it('getCutlistById returns a promise', () => {
    vi.spyOn(cutlistsService, 'getCutlistById').mockResolvedValue(null)
    const result = cutlistsService.getCutlistById('1')
    expect(result).toBeInstanceOf(Promise)
  })

  it('createCutlist returns a promise', () => {
    vi.spyOn(cutlistsService, 'createCutlist').mockResolvedValue({ id: '1' })
    const result = cutlistsService.createCutlist({ name: 'Test' })
    expect(result).toBeInstanceOf(Promise)
  })
})
