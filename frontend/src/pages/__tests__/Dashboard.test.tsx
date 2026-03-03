import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { Dashboard } from '../Dashboard'

vi.mock('@/store', () => ({
  useAppStore: () => ({ setCurrentJob: vi.fn() }),
}))

vi.mock('@/services/jobs', () => ({
  jobsService: {
    list: vi.fn().mockResolvedValue([]),
  },
}))

describe('Dashboard', () => {
  it('renders page heading', () => {
    render(<Dashboard />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders subtitle', () => {
    render(<Dashboard />)
    expect(screen.getByText('CNC Cabinet Manufacturing')).toBeInTheDocument()
  })

  it('renders New Job button', () => {
    render(<Dashboard />)
    expect(screen.getByRole('button', { name: /new job/i })).toBeInTheDocument()
  })

  it('renders stat cards', () => {
    render(<Dashboard />)
    expect(screen.getByText('Total Jobs')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Drafts')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('renders Active Jobs section', async () => {
    render(<Dashboard />)
    expect(await screen.findByText('Active Jobs')).toBeInTheDocument()
  })

  it('renders Draft Jobs section', async () => {
    render(<Dashboard />)
    expect(await screen.findByText('Draft Jobs')).toBeInTheDocument()
  })
})
