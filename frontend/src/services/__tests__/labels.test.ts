import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { labelsService } from '@/services/labels'

const mockTemplate = {
  id: 'label-1',
  name: 'Part Label',
  type: 'part',
  format: 'pdf',
  width: 100,
  height: 50,
  content: '',
  isDefault: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('labelsService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockTemplate })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockTemplate })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockTemplate })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getTemplates calls GET /labels/templates and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockTemplate] })
    const result = await labelsService.getTemplates()
    expect(getSpy).toHaveBeenCalledWith('/labels/templates', { params: undefined })
    expect(result).toEqual([mockTemplate])
  })

  it('getTemplates passes params', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockTemplate] })
    await labelsService.getTemplates({ type: 'part' })
    expect(getSpy).toHaveBeenCalledWith('/labels/templates', { params: { type: 'part' } })
  })

  it('getTemplate calls GET /labels/templates/:id and returns data', async () => {
    const result = await labelsService.getTemplate('label-1')
    expect(getSpy).toHaveBeenCalledWith('/labels/templates/label-1')
    expect(result).toEqual(mockTemplate)
  })

  it('createTemplate calls POST /labels/templates and returns data', async () => {
    const payload = { name: 'New Label', type: 'part' }
    const result = await labelsService.createTemplate(payload as any)
    expect(postSpy).toHaveBeenCalledWith('/labels/templates', payload)
    expect(result).toEqual(mockTemplate)
  })

  it('updateTemplate calls PATCH /labels/templates/:id and returns data', async () => {
    const changes = { name: 'Updated' }
    const result = await labelsService.updateTemplate('label-1', changes)
    expect(patchSpy).toHaveBeenCalledWith('/labels/templates/label-1', changes)
    expect(result).toEqual(mockTemplate)
  })

  it('deleteTemplate calls DELETE /labels/templates/:id', async () => {
    await labelsService.deleteTemplate('label-1')
    expect(deleteSpy).toHaveBeenCalledWith('/labels/templates/label-1')
  })

  it('printLabels calls POST /labels/print and returns data', async () => {
    const payload = { templateId: 'label-1', partIds: ['p1', 'p2'] }
    const mockBlob = new Blob()
    postSpy.mockResolvedValueOnce({ data: mockBlob })
    const result = await labelsService.printLabels(payload as any)
    expect(postSpy).toHaveBeenCalledWith('/labels/print', payload, { responseType: 'blob' })
    expect(result).toEqual(mockBlob)
  })
})
