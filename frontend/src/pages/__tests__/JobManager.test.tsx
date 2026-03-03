import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { JobManager } from '../JobManager'

vi.mock('@/store', () => ({
  useAppStore: () => ({ setCurrentJob: vi.fn() }),
}))

vi.mock('@/services/jobs', () => ({
  jobsService: {
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
  },
}))

describe('JobManager', () => {
  it('renders page heading', () => {
    render(<JobManager />)
    expect(screen.getByText('Job Manager')).toBeInTheDocument()
  })

  it('renders New Job button', () => {
    render(<JobManager />)
    expect(screen.getByRole('button', { name: /new job/i })).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(<JobManager />)
    expect(screen.getByPlaceholderText('Search jobs…')).toBeInTheDocument()
  })

  it('renders status filter', () => {
    render(<JobManager />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('All Status')).toBeInTheDocument()
  })
})
