import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { JobDashboard } from '../JobDashboard'

vi.mock('@/store', () => ({
  useAppStore: () => ({ setCurrentJob: vi.fn() }),
}))

vi.mock('@/services/jobs', () => ({
  jobsService: {
    get: vi.fn().mockResolvedValue({
      id: 'job-1',
      name: 'Kitchen Renovation',
      clientName: 'Acme Corp',
      status: 'in_progress',
      dueDate: '2025-04-15',
      productCount: 5,
      partCount: 24,
      roomCount: 2,
      estimatedValue: 15000,
    }),
  },
}))

vi.mock('@/services/rooms', () => ({
  roomsService: {
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
  },
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

function renderWithRoute() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/jobs/job-1']}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobDashboard />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('JobDashboard', () => {
  it('renders job name as heading', async () => {
    renderWithRoute()
    expect(await screen.findByText('Kitchen Renovation')).toBeInTheDocument()
  })

  it('renders job stats', async () => {
    renderWithRoute()
    expect((await screen.findAllByText('Rooms')).length).toBeGreaterThan(0)
    expect(screen.getByText('Products')).toBeInTheDocument()
    expect(screen.getByText('Parts')).toBeInTheDocument()
    expect(screen.getByText('Est. Value')).toBeInTheDocument()
  })

  it('renders Rooms section', async () => {
    renderWithRoute()
    expect((await screen.findAllByText('Rooms')).length).toBeGreaterThan(0)
  })

  it('renders Add Room button', async () => {
    renderWithRoute()
    expect(await screen.findByRole('button', { name: /add room/i })).toBeInTheDocument()
  })

  it('renders Edit Job button', async () => {
    renderWithRoute()
    expect(await screen.findByRole('button', { name: /edit job/i })).toBeInTheDocument()
  })
})
