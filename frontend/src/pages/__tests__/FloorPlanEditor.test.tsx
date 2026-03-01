import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { FloorPlanEditor } from '../FloorPlanEditor'

describe('FloorPlanEditor', () => {
  it('renders page heading', () => {
    render(<FloorPlanEditor />)
    expect(screen.getByText(/floor plan/i)).toBeInTheDocument()
  })

  it('renders canvas element', () => {
    render(<FloorPlanEditor />)
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('renders toolbar', () => {
    render(<FloorPlanEditor />)
    const btns = screen.getAllByRole('button')
    expect(btns.length).toBeGreaterThan(0)
  })

  it('snapshot', () => {
    const { container } = render(<FloorPlanEditor />)
    expect(container).toMatchSnapshot()
  })
})
