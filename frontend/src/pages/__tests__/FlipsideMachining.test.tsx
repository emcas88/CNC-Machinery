import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { FlipsideMachining } from '../FlipsideMachining'

describe('FlipsideMachining', () => {
  it('renders page heading', () => {
    render(<FlipsideMachining />)
    expect(screen.getByText(/flipside|flip side|machining/i)).toBeInTheDocument()
  })

  it('renders side toggle', () => {
    render(<FlipsideMachining />)
    expect(screen.getByText(/side a|side b|front|back/i)).toBeInTheDocument()
  })

  it('renders operation list', () => {
    render(<FlipsideMachining />)
    expect(screen.getByText(/operation|pocket|drill|slot/i)).toBeInTheDocument()
  })

  it('renders part selector', () => {
    render(<FlipsideMachining />)
    expect(screen.getByText(/part|panel|component/i)).toBeInTheDocument()
  })

  it('renders action buttons', () => {
    render(<FlipsideMachining />)
    const btns = screen.getAllByRole('button')
    expect(btns.length).toBeGreaterThan(0)
  })

  it('snapshot', () => {
    const { container } = render(<FlipsideMachining />)
    expect(container).toMatchSnapshot()
  })
})
