import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { JobDashboard } from '../JobDashboard'

describe('JobDashboard', () => {
  it('renders page heading', () => {
    render(<JobDashboard />)
    expect(screen.getByText(/job dashboard/i)).toBeInTheDocument()
  })

  it('renders job cards or rows', () => {
    render(<JobDashboard />)
    expect(screen.getByText(/JOB-/)).toBeInTheDocument()
  })

  it('renders status filters', () => {
    render(<JobDashboard />)
    expect(screen.getByText(/all|active|complete|pending/i)).toBeInTheDocument()
  })

  it('renders job progress indicators', () => {
    render(<JobDashboard />)
    expect(screen.getByText(/%|progress/i)).toBeInTheDocument()
  })

  it('renders client names', () => {
    render(<JobDashboard />)
    expect(screen.getByText(/johnson|smith|brown|client/i)).toBeInTheDocument()
  })

  it('snapshot', () => {
    const { container } = render(<JobDashboard />)
    expect(container).toMatchSnapshot()
  })
})
