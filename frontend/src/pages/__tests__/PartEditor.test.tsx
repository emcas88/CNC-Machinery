import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { PartEditor } from '@/pages/PartEditor'

describe('PartEditor', () => {
  it('renders without crashing', () => {
    render(<PartEditor />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Part Editor" heading', () => {
    render(<PartEditor />)
    expect(screen.getByText('Part Editor')).toBeInTheDocument()
  })

  it('renders the Part Drawing section', () => {
    render(<PartEditor />)
    expect(screen.getByText('Part Drawing')).toBeInTheDocument()
  })

  it('renders an SVG drawing area', () => {
    render(<PartEditor />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('renders the Part Properties panel', () => {
    render(<PartEditor />)
    expect(screen.getByText('Part Properties')).toBeInTheDocument()
  })

  it('renders Name, Width, Height, Thickness input fields', () => {
    render(<PartEditor />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Width')).toBeInTheDocument()
    expect(screen.getByText('Height')).toBeInTheDocument()
    expect(screen.getByText('Thickness')).toBeInTheDocument()
  })

  it('renders Grain Direction selector', () => {
    render(<PartEditor />)
    expect(screen.getByText('Grain Direction')).toBeInTheDocument()
  })

  it('renders the Edge Banding section with top/bottom/left/right checkboxes', () => {
    render(<PartEditor />)
    expect(screen.getByText('Edge Banding')).toBeInTheDocument()
    expect(screen.getByText('Top')).toBeInTheDocument()
    expect(screen.getByText('Bottom')).toBeInTheDocument()
    expect(screen.getByText('Left')).toBeInTheDocument()
    expect(screen.getByText('Right')).toBeInTheDocument()
  })
})
