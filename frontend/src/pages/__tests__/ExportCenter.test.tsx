import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { ExportCenter } from '../ExportCenter'

vi.mock('@/store', () => ({
  useAppStore: () => ({ currentJob: null }),
}))

describe('ExportCenter', () => {
  it('renders page heading', () => {
    render(<ExportCenter />)
    expect(screen.getByText('Export Center')).toBeInTheDocument()
  })

  it('renders export format options', () => {
    render(<ExportCenter />)
    expect(screen.getByText('Cut List CSV')).toBeInTheDocument()
    expect(screen.getByText('DXF Files')).toBeInTheDocument()
    expect(screen.getByText('SVG Nest')).toBeInTheDocument()
    expect(screen.getByText('Job PDF')).toBeInTheDocument()
    expect(screen.getByText('Machine XML')).toBeInTheDocument()
    expect(screen.getByText('JSON Export')).toBeInTheDocument()
  })

  it('renders Export buttons for each format', () => {
    render(<ExportCenter />)
    const exportBtns = screen.getAllByRole('button', { name: /export/i })
    expect(exportBtns.length).toBeGreaterThan(0)
  })

  it('shows "No job selected" when no currentJob', () => {
    render(<ExportCenter />)
    expect(screen.getByText(/no job selected/i)).toBeInTheDocument()
  })
})
