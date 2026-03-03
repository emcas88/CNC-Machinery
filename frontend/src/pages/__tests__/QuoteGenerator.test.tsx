import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import QuoteGenerator from './QuoteGenerator'

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockQuotesService = {
  getQuotes: vi.fn(),
  getQuote: vi.fn(),
  createQuote: vi.fn(),
  updateQuote: vi.fn(),
  deleteQuote: vi.fn(),
  generateEstimate: vi.fn(),
  exportQuote: vi.fn(),
  sendQuote: vi.fn(),
}

vi.mock('@/services/quotes', () => ({ quotesService: mockQuotesService }))

const mockStore: Record<string, unknown> = { currentJob: { id: 'job-1', name: 'Test Job' } }
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) => selector(mockStore),
}))

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const lineItem = {
  id: 'li-1',
  description: 'Cabinet Panel',
  category: 'Materials',
  quantity: 4,
  unit: 'ea',
  unitCost: 25.0,
  total: 100.0,
}

const quote = {
  id: 'q-1',
  jobId: 'job-1',
  name: 'Kitchen Quote',
  status: 'draft',
  lineItems: [lineItem],
  subtotal: 100,
  markupPercent: 20,
  taxRate: 10,
  total: 132,
  notes: 'Rush order',
  validUntil: '2026-04-01',
  clientName: 'Jane Doe',
  clientEmail: 'jane@example.com',
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
}

const estimate = {
  materials: [{ label: 'Plywood', quantity: 3, unit: 'sheet', unitCost: 50, total: 150 }],
  hardware: [{ label: 'Hinge', quantity: 8, unit: 'ea', unitCost: 5, total: 40 }],
  labour: [{ label: 'Assembly', quantity: 4, unit: 'hr', unitCost: 60, total: 240 }],
  overheads: [{ label: 'Shop', quantity: 1, unit: 'flat', unitCost: 50, total: 50 }],
  subtotal: 480,
  suggested: 620,
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function renderPage() {
  const client = createClient()
  return render(
    <QueryClientProvider client={client}>
      <QuoteGenerator />
    </QueryClientProvider>,
  )
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('QuoteGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.currentJob = { id: 'job-1', name: 'Test Job' }
  })

  /* ---- No job selected ---- */
  it('shows placeholder when no job is selected', () => {
    mockStore.currentJob = null
    renderPage()
    expect(screen.getByText(/select a job/i)).toBeInTheDocument()
  })

  /* ---- Loading state ---- */
  it('shows loading spinner while fetching quotes', () => {
    mockQuotesService.getQuotes.mockReturnValue(new Promise(() => {})) // never resolves
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  /* ---- Error state ---- */
  it('shows error state and retry button on failure', async () => {
    mockQuotesService.getQuotes.mockRejectedValue(new Error('Network error'))
    renderPage()
    await waitFor(() => expect(screen.getByText(/failed to load quotes/i)).toBeInTheDocument())
    expect(screen.getByText(/retry/i)).toBeInTheDocument()
  })

  it('retries on Retry click', async () => {
    mockQuotesService.getQuotes.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce([])
    renderPage()
    await waitFor(() => screen.getByText(/retry/i))
    fireEvent.click(screen.getByText(/retry/i))
    await waitFor(() => expect(mockQuotesService.getQuotes).toHaveBeenCalledTimes(2))
  })

  /* ---- Empty state ---- */
  it('shows empty state when no quotes exist', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText(/no quotes yet/i)).toBeInTheDocument())
  })

  /* ---- Renders quotes ---- */
  it('renders quote list with status badge and line items table', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    renderPage()
    await waitFor(() => expect(screen.getByText('Kitchen Quote')).toBeInTheDocument())
    expect(screen.getByText('draft')).toBeInTheDocument()
    expect(screen.getByText('Cabinet Panel')).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
  })

  it('shows quote details sidebar with client info', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('Rush order')).toBeInTheDocument()
  })

  /* ---- Add line item ---- */
  it('opens line item form and submits new line', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    mockQuotesService.updateQuote.mockResolvedValue({ ...quote, lineItems: [...quote.lineItems] })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('+ Add Line'))
    await user.click(screen.getByText('+ Add Line'))

    // Fill form
    const descInput = screen.getByLabelText('Description')
    await user.clear(descInput)
    await user.type(descInput, 'New Panel')
    const catInput = screen.getByLabelText('Category')
    await user.type(catInput, 'Wood')
    const qtyInput = screen.getByLabelText('Quantity')
    await user.clear(qtyInput)
    await user.type(qtyInput, '2')
    const costInput = screen.getByLabelText('Unit cost')
    await user.clear(costInput)
    await user.type(costInput, '30')

    await user.click(screen.getByText('Add'))

    await waitFor(() => {
      expect(mockQuotesService.updateQuote).toHaveBeenCalledWith('q-1', expect.objectContaining({
        lineItems: expect.arrayContaining([
          expect.objectContaining({ description: 'New Panel', quantity: 2, unitCost: 30 }),
        ]),
      }))
    })
  })

  /* ---- Edit line item ---- */
  it('edits an existing line item', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    mockQuotesService.updateQuote.mockResolvedValue(quote)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Cabinet Panel'))

    await user.click(screen.getByLabelText('Edit Cabinet Panel'))

    const descInput = screen.getByLabelText('Description')
    await user.clear(descInput)
    await user.type(descInput, 'Updated Panel')

    await user.click(screen.getByText('Update'))

    await waitFor(() => {
      expect(mockQuotesService.updateQuote).toHaveBeenCalledWith('q-1', expect.objectContaining({
        lineItems: expect.arrayContaining([
          expect.objectContaining({ id: 'li-1', description: 'Updated Panel' }),
        ]),
      }))
    })
  })

  /* ---- Delete line item ---- */
  it('deletes a line item', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    mockQuotesService.updateQuote.mockResolvedValue({ ...quote, lineItems: [] })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Cabinet Panel'))
    await user.click(screen.getByLabelText('Delete Cabinet Panel'))
    await waitFor(() => {
      expect(mockQuotesService.updateQuote).toHaveBeenCalledWith('q-1', expect.objectContaining({
        lineItems: [],
      }))
    })
  })

  /* ---- Cancel line form ---- */
  it('hides line form on cancel', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('+ Add Line'))
    await user.click(screen.getByText('+ Add Line'))
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    await user.click(screen.getByText('Cancel'))
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument()
  })

  /* ---- Markup slider ---- */
  it('updates markup via slider', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    mockQuotesService.updateQuote.mockResolvedValue(quote)
    renderPage()
    await waitFor(() => screen.getByLabelText('Markup percent'))
    fireEvent.change(screen.getByLabelText('Markup percent'), { target: { value: '30' } })
    await waitFor(() => {
      expect(mockQuotesService.updateQuote).toHaveBeenCalledWith('q-1', { markupPercent: 30 })
    })
  })

  /* ---- Tax slider ---- */
  it('updates tax rate via slider', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    mockQuotesService.updateQuote.mockResolvedValue(quote)
    renderPage()
    await waitFor(() => screen.getByLabelText('Tax rate'))
    fireEvent.change(screen.getByLabelText('Tax rate'), { target: { value: '15' } })
    await waitFor(() => {
      expect(mockQuotesService.updateQuote).toHaveBeenCalledWith('q-1', { taxRate: 15 })
    })
  })

  /* ---- Generate Estimate ---- */
  it('generates estimate and shows panel', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    mockQuotesService.generateEstimate.mockResolvedValue(estimate)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Generate Estimate'))
    await user.click(screen.getByText('Generate Estimate'))
    await waitFor(() => {
      expect(mockQuotesService.generateEstimate).toHaveBeenCalledWith('job-1')
      expect(screen.getByTestId('estimate-panel')).toBeInTheDocument()
      expect(screen.getByText('$620.00')).toBeInTheDocument()
    })
  })

  it('shows error when estimate generation fails', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    mockQuotesService.generateEstimate.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Generate Estimate'))
    await user.click(screen.getByText('Generate Estimate'))
    await waitFor(() => expect(screen.getByText(/failed to generate estimate/i)).toBeInTheDocument())
  })

  /* ---- Export PDF ---- */
  it('exports PDF and triggers download', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' })
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    mockQuotesService.exportQuote.mockResolvedValue(blob)
    const createObjectURL = vi.fn(() => 'blob:url')
    const revokeObjectURL = vi.fn()
    global.URL.createObjectURL = createObjectURL
    global.URL.revokeObjectURL = revokeObjectURL
    const clickSpy = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValueOnce({ set href(_: string) {}, set download(_: string) {}, click: clickSpy } as unknown as HTMLElement)

    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Export PDF'))
    await user.click(screen.getByText('Export PDF'))
    await waitFor(() => {
      expect(mockQuotesService.exportQuote).toHaveBeenCalledWith('q-1', 'pdf')
    })
  })

  /* ---- Delete quote ---- */
  it('deletes a quote after confirmation', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    mockQuotesService.deleteQuote.mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Delete Quote'))
    await user.click(screen.getByText('Delete Quote'))
    await waitFor(() => expect(mockQuotesService.deleteQuote).toHaveBeenCalledWith('q-1'))
  })

  it('does not delete quote when confirmation is cancelled', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Delete Quote'))
    await user.click(screen.getByText('Delete Quote'))
    expect(mockQuotesService.deleteQuote).not.toHaveBeenCalled()
  })

  /* ---- Send to client modal ---- */
  it('opens send modal, fills email, and sends', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    mockQuotesService.sendQuote.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Send to Client'))
    await user.click(screen.getByText('Send to Client'))

    expect(screen.getByRole('dialog', { name: /send quote/i })).toBeInTheDocument()

    const emailInput = screen.getByLabelText('Client email')
    await user.type(emailInput, 'bob@example.com')
    await user.click(screen.getByText('Send'))

    await waitFor(() => {
      expect(mockQuotesService.sendQuote).toHaveBeenCalledWith('q-1', 'bob@example.com')
    })
  })

  it('shows error in send modal on failure', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    mockQuotesService.sendQuote.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Send to Client'))
    await user.click(screen.getByText('Send to Client'))
    await user.type(screen.getByLabelText('Client email'), 'x@y.com')
    await user.click(screen.getByText('Send'))
    await waitFor(() => expect(screen.getByText(/failed to send quote/i)).toBeInTheDocument())
  })

  it('closes send modal on cancel', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([quote])
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Send to Client'))
    await user.click(screen.getByText('Send to Client'))
    expect(screen.getByRole('dialog', { name: /send quote/i })).toBeInTheDocument()
    await user.click(screen.getAllByText('Cancel')[0])
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /send quote/i })).not.toBeInTheDocument())
  })

  /* ---- Create quote modal ---- */
  it('opens create modal, fills form, and creates quote', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([])
    mockQuotesService.createQuote.mockResolvedValue({ ...quote, id: 'q-new' })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('+ New Quote'))
    await user.click(screen.getByText('+ New Quote'))

    expect(screen.getByRole('dialog', { name: /create quote/i })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Quote name'), 'My Quote')
    await user.type(screen.getByLabelText('Notes'), 'Some notes')
    await user.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockQuotesService.createQuote).toHaveBeenCalledWith(expect.objectContaining({
        jobId: 'job-1',
        name: 'My Quote',
        notes: 'Some notes',
      }))
    })
  })

  it('shows error in create modal on failure', async () => {
    mockQuotesService.getQuotes.mockResolvedValue([])
    mockQuotesService.createQuote.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('+ New Quote'))
    await user.click(screen.getByText('+ New Quote'))
    await user.type(screen.getByLabelText('Quote name'), 'Fail Quote')
    await user.click(screen.getByText('Create'))
    await waitFor(() => expect(screen.getByText(/failed to create quote/i)).toBeInTheDocument())
  })

  /* ---- Quote selector switching ---- */
  it('switches between quotes when clicking tabs', async () => {
    const quote2 = { ...quote, id: 'q-2', name: 'Bathroom Quote', status: 'sent', lineItems: [] }
    mockQuotesService.getQuotes.mockResolvedValue([quote, quote2])
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Kitchen Quote'))
    // Cabinet Panel should be visible (from first quote)
    expect(screen.getByText('Cabinet Panel')).toBeInTheDocument()

    await user.click(screen.getByText('Bathroom Quote'))
    // Second quote has no line items
    await waitFor(() => expect(screen.getByText(/no line items yet/i)).toBeInTheDocument())
  })
})
