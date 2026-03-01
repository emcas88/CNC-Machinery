import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { CNCOperatorView } from '../CNCOperatorView'

describe('CNCOperatorView', () => {
  it('renders page heading', () => {
    render(<CNCOperatorView />)
    expect(screen.getByText(/cnc operator/i)).toBeInTheDocument()
  })

  it('renders machine status', () => {
    render(<CNCOperatorView />)
    expect(screen.getByText(/machine|status/i)).toBeInTheDocument()
  })

  it('renders job queue', () => {
    render(<CNCOperatorView />)
    expect(screen.getByText(/queue|job/i)).toBeInTheDocument()
  })

  it('renders action buttons', () => {
    render(<CNCOperatorView />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('snapshot', () => {
    const { container } = render(<CNCOperatorView />)
    expect(container).toMatchSnapshot()
  })
})
