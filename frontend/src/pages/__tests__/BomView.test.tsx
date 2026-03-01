import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { BomView } from '../BomView'

describe('BomView', () => {
  it('renders page heading', () => {
    render(<BomView />)
    expect(screen.getByText(/bill of materials/i)).toBeInTheDocument()
  })

  it('renders export button', () => {
    render(<BomView />)
    expect(screen.getByText(/export/i)).toBeInTheDocument()
  })

  it('renders material rows', () => {
    render(<BomView />)
    expect(screen.getByText(/birch ply/i)).toBeInTheDocument()
  })

  it('renders category badges', () => {
    render(<BomView />)
    const badges = screen.getAllByText(/sheet goods|hardware|edging/i)
    expect(badges.length).toBeGreaterThan(0)
  })

  it('snapshot', () => {
    const { container } = render(<BomView />)
    expect(container).toMatchSnapshot()
  })
})
