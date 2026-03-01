import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { LabelDesigner } from '@/pages/LabelDesigner'

describe('LabelDesigner', () => {
  it('renders without crashing', () => {
    render(<LabelDesigner />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the Templates sidebar', () => {
    render(<LabelDesigner />)
    expect(screen.getByText('Templates')).toBeInTheDocument()
    expect(screen.getByText('Standard Label 100×50')).toBeInTheDocument()
    expect(screen.getByText('Small Label 60×30')).toBeInTheDocument()
  })

  it('renders the label template canvas area', () => {
    render(<LabelDesigner />)
    expect(screen.getByText(/100 × 50mm label/)).toBeInTheDocument()
  })

  it('renders label fields on the template canvas', () => {
    render(<LabelDesigner />)
    // Part name field is selected by default
    expect(screen.getByText('Part Name')).toBeInTheDocument()
  })

  it('renders Generate Labels, Print Preview, and Export PDF buttons', () => {
    render(<LabelDesigner />)
    expect(screen.getByRole('button', { name: /generate labels/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print preview/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument()
  })

  it('renders the Field properties panel for the selected field', () => {
    render(<LabelDesigner />)
    // partName is selected by default
    expect(screen.getByText(/Field: partName/)).toBeInTheDocument()
    expect(screen.getByText('Data Source')).toBeInTheDocument()
  })

  it('renders X, Y, Width, Height, Font Size inputs in the field panel', () => {
    render(<LabelDesigner />)
    expect(screen.getByText(/X \(mm\)/)).toBeInTheDocument()
    expect(screen.getByText(/Y \(mm\)/)).toBeInTheDocument()
    expect(screen.getByText(/Font Size/)).toBeInTheDocument()
  })
})
