import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { CutListView } from '../CutListView'

vi.mock('@/store', () => ({
  useAppStore: () => ({ currentJob: null }),
}))

vi.mock('@/services/cutlists', () => ({
  cutlistsService: {
    getCutlist: vi.fn().mockResolvedValue([]),
  },
}))

describe('CutListView', () => {
  it('renders page heading', () => {
    render(<CutListView />)
    expect(screen.getByText('Cut List')).toBeInTheDocument()
  })

  it('renders Export CSV button', () => {
    render(<CutListView />)
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
  })

  it('shows "Select a job to view cut list" when no currentJob', async () => {
    render(<CutListView />)
    expect(await screen.findByText('Select a job to view cut list')).toBeInTheDocument()
  })

  it('renders search/filter input', () => {
    render(<CutListView />)
    expect(screen.getByPlaceholderText('Filter parts…')).toBeInTheDocument()
  })
})
