import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { MultiPrintEditor } from '@/pages/MultiPrintEditor'

describe('MultiPrintEditor', () => {
  it('renders without crashing', () => {
    render(<MultiPrintEditor />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the Views sidebar with drawing views', () => {
    render(<MultiPrintEditor />)
    expect(screen.getByText('Views')).toBeInTheDocument()
    expect(screen.getByText('Floor Plan')).toBeInTheDocument()
    expect(screen.getByText('North Elevation')).toBeInTheDocument()
    expect(screen.getByText('3D Perspective')).toBeInTheDocument()
  })

  it('renders the Templates section in the sidebar', () => {
    render(<MultiPrintEditor />)
    expect(screen.getByText('Templates')).toBeInTheDocument()
    expect(screen.getByText('A4 Landscape')).toBeInTheDocument()
    expect(screen.getByText('A3 Portrait')).toBeInTheDocument()
  })

  it('renders the drawing canvas area with page format info', () => {
    render(<MultiPrintEditor />)
    expect(screen.getByText(/A3 Landscape/)).toBeInTheDocument()
  })

  it('renders the title block on the drawing canvas', () => {
    render(<MultiPrintEditor />)
    expect(screen.getByText(/Kitchen Renovation/)).toBeInTheDocument()
  })

  it('renders Export PDF and Export DXF buttons', () => {
    render(<MultiPrintEditor />)
    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export dxf/i })).toBeInTheDocument()
  })
})
