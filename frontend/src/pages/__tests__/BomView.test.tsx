import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { BomView } from '../BomView'

vi.mock('@/store', () => ({
  useAppStore: () => ({ currentJob: null }),
}))

vi.mock('@/services/cutlists', () => ({
  cutlistsService: {
    getBom: vi.fn(),
    getBoq: vi.fn(),
  },
}))

import { cutlistsService } from '@/services/cutlists'

describe('BomView', () => {
  beforeEach(() => {
    vi.mocked(cutlistsService.getBom).mockResolvedValue([])
    vi.mocked(cutlistsService.getBoq).mockResolvedValue([])
  })

  it('renders page heading', () => {
    render(<BomView />)
    expect(screen.getByText('Bill of Materials')).toBeInTheDocument()
  })

  it('renders export button', () => {
    render(<BomView />)
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
  })

  it('shows "Select a job first" when no currentJob', () => {
    render(<BomView />)
    expect(screen.getByText('Select a job first')).toBeInTheDocument()
  })

  it('renders BOM and BOQ tabs', () => {
    render(<BomView />)
    expect(screen.getByText('Bill of Materials (BOM)')).toBeInTheDocument()
    expect(screen.getByText('Bill of Quantities (BOQ)')).toBeInTheDocument()
  })

  it('renders Grand Total footer', () => {
    render(<BomView />)
    expect(screen.getByText(/Grand Total:/)).toBeInTheDocument()
  })
})
