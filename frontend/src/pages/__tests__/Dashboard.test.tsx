import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { Dashboard } from '../Dashboard'

describe('Dashboard', () => {
  it('renders page heading', () => {
    render(<Dashboard />)
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
  })

  it('renders stat cards', () => {
    render(<Dashboard />)
    // Stat cards show numeric values
    const nums = screen.getAllByText(/\d+/)
    expect(nums.length).toBeGreaterThan(0)
  })

  it('renders active jobs section', () => {
    render(<Dashboard />)
    expect(screen.getByText(/active job/i)).toBeInTheDocument()
  })

  it('renders quick actions', () => {
    render(<Dashboard />)
    expect(screen.getByText(/new job|quick action/i)).toBeInTheDocument()
  })

  it('renders machine status', () => {
    render(<Dashboard />)
    expect(screen.getByText(/machine|cnc/i)).toBeInTheDocument()
  })

  it('renders recent activity', () => {
    render(<Dashboard />)
    expect(screen.getByText(/recent|activity/i)).toBeInTheDocument()
  })

  it('snapshot', () => {
    const { container } = render(<Dashboard />)
    expect(container).toMatchSnapshot()
  })
})
