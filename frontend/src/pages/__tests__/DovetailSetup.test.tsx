import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { DovetailSetup } from '../DovetailSetup'

describe('DovetailSetup', () => {
  it('renders page heading', () => {
    render(<DovetailSetup />)
    expect(screen.getByText('Dovetail Setup')).toBeInTheDocument()
  })

  it('renders Bit Settings section', () => {
    render(<DovetailSetup />)
    expect(screen.getByText('Bit Settings')).toBeInTheDocument()
  })

  it('renders parameter inputs', () => {
    render(<DovetailSetup />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThan(0)
  })

  it('renders Bit Diameter, Cutting Depth, Flute Angle, Pitch labels', () => {
    render(<DovetailSetup />)
    expect(screen.getByText('Bit Diameter (mm)')).toBeInTheDocument()
    expect(screen.getByText('Cutting Depth (mm)')).toBeInTheDocument()
    expect(screen.getByText('Flute Angle (°)')).toBeInTheDocument()
    expect(screen.getByText('Pitch (mm)')).toBeInTheDocument()
  })

  it('renders Drawer Box Dimensions section', () => {
    render(<DovetailSetup />)
    expect(screen.getByText('Drawer Box Dimensions')).toBeInTheDocument()
  })

  it('renders Machine Offsets section', () => {
    render(<DovetailSetup />)
    expect(screen.getByText('Machine Offsets')).toBeInTheDocument()
  })

  it('renders Save Dovetail Config button', () => {
    render(<DovetailSetup />)
    expect(screen.getByRole('button', { name: /save dovetail config/i })).toBeInTheDocument()
  })
})
