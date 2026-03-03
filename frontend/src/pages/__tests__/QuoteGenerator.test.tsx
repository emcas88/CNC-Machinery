import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { QuoteGenerator } from '@/pages/QuoteGenerator'

vi.mock('@/store', () => ({
  useAppStore: () => ({ currentJob: null }),
}))

describe('QuoteGenerator', () => {
  const renderPage = () => render(<QuoteGenerator />)

  it('renders without crashing', () => {
    renderPage()
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Quote Generator" heading', () => {
    renderPage()
    expect(screen.getByText('Quote Generator')).toBeInTheDocument()
  })

  it('renders Export PDF and Add Line buttons', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add line/i })).toBeInTheDocument()
  })

  it('renders the Line Items table with column headers', () => {
    renderPage()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Unit Cost')).toBeInTheDocument()
  })

  it('renders mock line items', () => {
    renderPage()
    expect(screen.getByText(/18mm Birch Ply/)).toBeInTheDocument()
    expect(screen.getByText(/Blum Clip-top Hinges/)).toBeInTheDocument()
    expect(screen.getByText(/CNC Cutting Labour/)).toBeInTheDocument()
  })

  it('renders the pricing summary with Subtotal, Markup, and Total', () => {
    renderPage()
    expect(screen.getAllByText(/Subtotal/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Markup/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/GST/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Total/).length).toBeGreaterThan(0)
  })

  it('renders Pricing Controls section', () => {
    renderPage()
    expect(screen.getByText('Pricing Controls')).toBeInTheDocument()
  })

  it('renders Summary section', () => {
    renderPage()
    expect(screen.getByText('Summary')).toBeInTheDocument()
  })
})
