import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { LabelDesigner } from '../LabelDesigner'

vi.mock('@/store', () => ({
  useAppStore: () => ({ currentJob: null }),
}))

vi.mock('@/services/cutlists', () => ({
  cutlistsService: {
    getCutlist: vi.fn().mockResolvedValue([]),
  },
}))

describe('LabelDesigner', () => {
  it('renders without crashing', () => {
    render(<LabelDesigner />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders Label Settings sidebar', () => {
    render(<LabelDesigner />)
    expect(screen.getByText('Label Settings')).toBeInTheDocument()
  })

  it('renders Template select', () => {
    render(<LabelDesigner />)
    expect(screen.getByText('Template')).toBeInTheDocument()
    expect(screen.getByText('Standard Label')).toBeInTheDocument()
    expect(screen.getByText('Compact (50×25)')).toBeInTheDocument()
    expect(screen.getByText('Large (100×75)')).toBeInTheDocument()
    expect(screen.getByText('QR Code Label')).toBeInTheDocument()
  })

  it('renders Show Fields checkboxes', () => {
    render(<LabelDesigner />)
    expect(screen.getByText('QR Code')).toBeInTheDocument()
    expect(screen.getByText('Dimensions')).toBeInTheDocument()
    expect(screen.getByText('Material')).toBeInTheDocument()
    expect(screen.getByText('Room Name')).toBeInTheDocument()
  })

  it('renders Print All Labels and Export PDF buttons', () => {
    render(<LabelDesigner />)
    expect(screen.getByRole('button', { name: /print all labels/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument()
  })

  it('shows "Select a job first" when no currentJob and no cutlist', async () => {
    render(<LabelDesigner />)
    expect(await screen.findByText('Select a job first')).toBeInTheDocument()
  })
})
