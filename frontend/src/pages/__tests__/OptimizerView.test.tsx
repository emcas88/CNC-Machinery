import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { OptimizerView } from '@/pages/OptimizerView'

vi.mock('@/store', () => ({
  useAppStore: () => ({ currentJob: null }),
  useOptimizerStore: () => ({
    sheets: [],
    setSheets: vi.fn(),
    selectedSheetIndex: 0,
    setSelectedSheetIndex: vi.fn(),
  }),
}))

vi.mock('@/services/optimizer', () => ({
  optimizerService: { optimize: vi.fn() },
}))

describe('OptimizerView', () => {
  const renderPage = () => render(<OptimizerView />)

  it('renders without crashing', () => {
    renderPage()
    expect(document.body).toBeInTheDocument()
  })

  it('renders the Optimizer heading', () => {
    renderPage()
    expect(screen.getByText('Optimizer')).toBeInTheDocument()
  })

  it('renders the Algorithm select with Guillotine and MaxRects', () => {
    renderPage()
    expect(screen.getByText('Algorithm')).toBeInTheDocument()
    expect(screen.getByText('Guillotine')).toBeInTheDocument()
    expect(screen.getByText('MaxRects')).toBeInTheDocument()
  })

  it('renders Blade Kerf and Edge Banding inputs', () => {
    renderPage()
    expect(screen.getByText('Blade Kerf (mm)')).toBeInTheDocument()
    expect(screen.getByText('Edge Banding (mm)')).toBeInTheDocument()
  })

  it('renders Respect Grain Direction checkbox', () => {
    renderPage()
    expect(screen.getByText('Respect Grain Direction')).toBeInTheDocument()
  })

  it('renders the Run Optimizer button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /run optimizer/i })).toBeInTheDocument()
  })

  it('shows "No sheets yet" message when no optimization has run', () => {
    renderPage()
    expect(screen.getByText(/no sheets yet/i)).toBeInTheDocument()
  })

  it('shows "Run the optimizer to see nesting results" placeholder', () => {
    renderPage()
    expect(screen.getByText(/run the optimizer to see nesting results/i)).toBeInTheDocument()
  })
})
