import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { JobManager } from '../JobManager'

describe('JobManager', () => {
  it('renders page heading', () => {
    render(<JobManager />)
    expect(screen.getByText(/job manager/i)).toBeInTheDocument()
  })

  it('renders job list', () => {
    render(<JobManager />)
    expect(screen.getByText(/JOB-/)).toBeInTheDocument()
  })

  it('renders create job button', () => {
    render(<JobManager />)
    expect(screen.getByText(/new job|create/i)).toBeInTheDocument()
  })

  it('renders search or filter', () => {
    render(<JobManager />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('snapshot', () => {
    const { container } = render(<JobManager />)
    expect(container).toMatchSnapshot()
  })
})
