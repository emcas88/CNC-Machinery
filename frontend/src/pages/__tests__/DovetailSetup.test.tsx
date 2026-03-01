import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { DovetailSetup } from '../DovetailSetup'

describe('DovetailSetup', () => {
  it('renders page heading', () => {
    render(<DovetailSetup />)
    expect(screen.getByText(/dovetail/i)).toBeInTheDocument()
  })

  it('renders parameter inputs', () => {
    render(<DovetailSetup />)
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs.length).toBeGreaterThan(0)
  })

  it('renders diagram or preview', () => {
    render(<DovetailSetup />)
    expect(screen.getByText(/angle|pitch|spacing/i)).toBeInTheDocument()
  })

  it('renders save button', () => {
    render(<DovetailSetup />)
    expect(screen.getByText(/save|apply/i)).toBeInTheDocument()
  })

  it('snapshot', () => {
    const { container } = render(<DovetailSetup />)
    expect(container).toMatchSnapshot()
  })
})
