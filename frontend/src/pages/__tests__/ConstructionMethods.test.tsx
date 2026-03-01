import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { ConstructionMethods } from '../ConstructionMethods'

describe('ConstructionMethods', () => {
  it('renders page heading', () => {
    render(<ConstructionMethods />)
    expect(screen.getByText(/construction method/i)).toBeInTheDocument()
  })

  it('renders method cards', () => {
    render(<ConstructionMethods />)
    expect(screen.getByText(/dowel|biscuit|dado|pocket/i)).toBeInTheDocument()
  })

  it('renders select buttons', () => {
    render(<ConstructionMethods />)
    const btns = screen.getAllByRole('button')
    expect(btns.length).toBeGreaterThan(0)
  })

  it('renders default selection badge', () => {
    render(<ConstructionMethods />)
    expect(screen.getByText(/default/i)).toBeInTheDocument()
  })

  it('snapshot', () => {
    const { container } = render(<ConstructionMethods />)
    expect(container).toMatchSnapshot()
  })
})
