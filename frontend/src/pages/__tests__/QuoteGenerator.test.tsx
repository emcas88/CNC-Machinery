import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { QuoteGenerator } from '@/pages/QuoteGenerator'

describe('QuoteGenerator', () => {
  it('renders without crashing', () => {
    render(<QuoteGenerator />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Quote Generator" heading', () => {
    render(<QuoteGenerator />)
    expect(screen.getByText('Quote Generator')).toBeInTheDocument()
  })

  it('renders Send Quote and Export PDF buttons', () => {
    render(<QuoteGenerator />)
    expect(screen.getByRole('button', { name: /send quote/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument()
  })

  it('renders the Line Items table with column headers', () => {
    render(<QuoteGenerator />)
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Unit Cost')).toBeInTheDocument()
  })

  it('renders mock line items', () => {
    render(<QuoteGenerator />)
    expect(screen.getByText(/18mm Birch Ply/)).toBeInTheDocument()
    expect(screen.getByText(/Blum Clip-top Hinges/)).toBeInTheDocument()
    expect(screen.getByText(/CNC Cutting Labour/)).toBeInTheDocument()
  })

  it('renders the pricing summary with Subtotal, Markup, Tax, and Total', () => {
    render(<QuoteGenerator />)
    expect(screen.getByText('Subtotal')).toBeInTheDocument()
    expect(screen.getByText('Markup %')).toBeInTheDocument()
    expect(screen.getByText('Tax %')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('renders the category Breakdown section', () => {
    render(<QuoteGenerator />)
    expect(screen.getByText('Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Materials')).toBeInTheDocument()
    expect(screen.getByText('Labour')).toBeInTheDocument()
  })

  it('renders the Notes textarea', () => {
    render(<QuoteGenerator />)
    expect(screen.getByPlaceholderText(/quote notes/i)).toBeInTheDocument()
  })

  it('renders "Generate from Job" button', () => {
    render(<QuoteGenerator />)
    expect(screen.getByRole('button', { name: /generate from job/i })).toBeInTheDocument()
  })
})
