import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { ExportCenter } from '../ExportCenter'

describe('ExportCenter', () => {
  it('renders page heading', () => {
    render(<ExportCenter />)
    expect(screen.getByText(/export center/i)).toBeInTheDocument()
  })

  it('renders export format options', () => {
    render(<ExportCenter />)
    expect(screen.getByText(/dxf|pdf|csv|svg/i)).toBeInTheDocument()
  })

  it('renders export buttons', () => {
    render(<ExportCenter />)
    const btns = screen.getAllByRole('button')
    expect(btns.length).toBeGreaterThan(0)
  })

  it('renders recent exports section', () => {
    render(<ExportCenter />)
    expect(screen.getByText(/recent|history/i)).toBeInTheDocument()
  })

  it('renders file size or metadata', () => {
    render(<ExportCenter />)
    expect(screen.getByText(/kb|mb|size/i)).toBeInTheDocument()
  })

  it('snapshot', () => {
    const { container } = render(<ExportCenter />)
    expect(container).toMatchSnapshot()
  })
})
