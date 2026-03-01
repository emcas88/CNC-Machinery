import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { OptimizerView } from '@/pages/OptimizerView'

describe('OptimizerView', () => {
  it('renders without crashing', () => {
    render(<OptimizerView />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the Parts list panel', () => {
    render(<OptimizerView />)
    expect(screen.getByText('Parts')).toBeInTheDocument()
  })

  it('renders the Settings panel heading', () => {
    render(<OptimizerView />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders quality option buttons (Draft, Standard, High, Maximum)', () => {
    render(<OptimizerView />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Maximum')).toBeInTheDocument()
  })

  it('renders Part Spacing and Edge Margin inputs', () => {
    render(<OptimizerView />)
    expect(screen.getByText('Part Spacing (mm)')).toBeInTheDocument()
    expect(screen.getByText('Edge Margin (mm)')).toBeInTheDocument()
  })

  it('renders Respect Grain and Allow Rotation toggle labels', () => {
    render(<OptimizerView />)
    expect(screen.getByText('Respect Grain')).toBeInTheDocument()
    expect(screen.getByText('Allow Rotation')).toBeInTheDocument()
  })

  it('renders the "Run Optimizer" button', () => {
    render(<OptimizerView />)
    expect(screen.getByRole('button', { name: /run optimizer/i })).toBeInTheDocument()
  })

  it('shows "No sheets" message when no optimization has run', () => {
    render(<OptimizerView />)
    expect(screen.getByText(/no sheets/i)).toBeInTheDocument()
  })

  it('shows "No optimization run yet" placeholder when no run exists', () => {
    render(<OptimizerView />)
    expect(screen.getByText(/no optimization run yet/i)).toBeInTheDocument()
  })

  it('shows "Ready to optimize" in the stats bar', () => {
    render(<OptimizerView />)
    expect(screen.getByText('Ready to optimize')).toBeInTheDocument()
  })
})
