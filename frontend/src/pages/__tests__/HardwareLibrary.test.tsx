import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HardwareLibrary from './HardwareLibrary'

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockHardwareService = {
  getHardware: vi.fn(),
  getHardwareItem: vi.fn(),
  createHardware: vi.fn(),
  updateHardware: vi.fn(),
  deleteHardware: vi.fn(),
  getHardwareCategories: vi.fn(),
}

vi.mock('@/services/hardware', () => ({ hardwareService: mockHardwareService }))

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const hinge = {
  id: 'hw-1',
  name: 'Blum Hinge 110°',
  type: 'hinge',
  sku: 'BLM-110',
  description: 'Soft-close hinge for overlay doors',
  costPerUnit: 4.50,
  inStock: true,
  drillingX: 52,
  drillingY: 0,
  drillingDiameter: 35,
  notes: '',
  createdAt: '2026-01-01T00:00:00Z',
}

const slide = {
  id: 'hw-2',
  name: 'Drawer Slide 18"',
  type: 'slide',
  sku: 'SLD-18',
  description: 'Full extension ball bearing slide',
  costPerUnit: 12.99,
  inStock: false,
  createdAt: '2026-01-01T00:00:00Z',
}

const allHardware = [hinge, slide]

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
      <HardwareLibrary />
    </QueryClientProvider>,
  )
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('HardwareLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHardwareService.getHardwareCategories.mockResolvedValue([])
  })

  /* ---- Loading ---- */
  it('shows loading spinner while fetching', () => {
    mockHardwareService.getHardware.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  /* ---- Error ---- */
  it('shows error state with retry button', async () => {
    mockHardwareService.getHardware.mockRejectedValue(new Error('fail'))
    renderPage()
    await waitFor(() => expect(screen.getByText(/failed to load hardware/i)).toBeInTheDocument())
    expect(screen.getByText(/retry/i)).toBeInTheDocument()
  })

  it('retries on Retry click', async () => {
    mockHardwareService.getHardware.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce([])
    renderPage()
    await waitFor(() => screen.getByText(/retry/i))
    fireEvent.click(screen.getByText(/retry/i))
    await waitFor(() => expect(mockHardwareService.getHardware).toHaveBeenCalledTimes(2))
  })

  /* ---- Empty state ---- */
  it('shows empty state when no hardware items exist', async () => {
    mockHardwareService.getHardware.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText(/no hardware items yet/i)).toBeInTheDocument())
  })

  /* ---- Renders items ---- */
  it('renders hardware cards with name, type, cost, stock status', async () => {
    mockHardwareService.getHardware.mockResolvedValue(allHardware)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Blum Hinge 110°')).toBeInTheDocument()
      expect(screen.getByText('Drawer Slide 18"')).toBeInTheDocument()
    })
    expect(screen.getByText('$4.50 / unit')).toBeInTheDocument()
    expect(screen.getByText('In Stock')).toBeInTheDocument()
    expect(screen.getByText('Out of Stock')).toBeInTheDocument()
  })

  it('shows drilling pattern info', async () => {
    mockHardwareService.getHardware.mockResolvedValue([hinge])
    renderPage()
    await waitFor(() => expect(screen.getByText(/52 × 0 mm/)).toBeInTheDocument())
    expect(screen.getByText(/⌀ 35 mm/)).toBeInTheDocument()
  })

  it('shows item count', async () => {
    mockHardwareService.getHardware.mockResolvedValue(allHardware)
    renderPage()
    await waitFor(() => expect(screen.getByText(/showing 2 of 2 items/i)).toBeInTheDocument())
  })

  /* ---- Search ---- */
  it('filters hardware by search query', async () => {
    mockHardwareService.getHardware.mockResolvedValue(allHardware)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Blum Hinge 110°'))

    await u.type(screen.getByLabelText('Search hardware'), 'Drawer')
    expect(screen.queryByText('Blum Hinge 110°')).not.toBeInTheDocument()
    expect(screen.getByText('Drawer Slide 18"')).toBeInTheDocument()
  })

  it('filters by SKU', async () => {
    mockHardwareService.getHardware.mockResolvedValue(allHardware)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Blum Hinge 110°'))
    await u.type(screen.getByLabelText('Search hardware'), 'BLM')
    expect(screen.getByText('Blum Hinge 110°')).toBeInTheDocument()
    expect(screen.queryByText('Drawer Slide 18"')).not.toBeInTheDocument()
  })

  it('shows no match message when search returns nothing', async () => {
    mockHardwareService.getHardware.mockResolvedValue(allHardware)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Blum Hinge 110°'))
    await u.type(screen.getByLabelText('Search hardware'), 'zzzzz')
    expect(screen.getByText(/no items match/i)).toBeInTheDocument()
  })

  /* ---- Type filter ---- */
  it('filters by hardware type', async () => {
    mockHardwareService.getHardware.mockResolvedValue(allHardware)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Blum Hinge 110°'))

    await u.selectOptions(screen.getByLabelText('Filter by type'), 'slide')
    expect(screen.queryByText('Blum Hinge 110°')).not.toBeInTheDocument()
    expect(screen.getByText('Drawer Slide 18"')).toBeInTheDocument()
  })

  /* ---- Create hardware ---- */
  it('opens add modal and creates hardware', async () => {
    mockHardwareService.getHardware.mockResolvedValue([])
    mockHardwareService.createHardware.mockResolvedValue({ ...hinge, id: 'hw-new' })
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('+ Add Hardware'))

    await u.click(screen.getByText('+ Add Hardware'))
    expect(screen.getByRole('dialog', { name: /add hardware/i })).toBeInTheDocument()

    await u.type(screen.getByLabelText('Name *'), 'Test Hinge')
    await u.selectOptions(screen.getByLabelText('Type'), 'hinge')
    await u.type(screen.getByLabelText('SKU'), 'TST-1')

    const costInput = screen.getByLabelText('Cost / Unit ($)')
    await u.clear(costInput)
    await u.type(costInput, '5.00')

    await u.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockHardwareService.createHardware).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test Hinge',
        type: 'hinge',
        sku: 'TST-1',
      }))
    })
  })

  it('shows error when create fails', async () => {
    mockHardwareService.getHardware.mockResolvedValue([])
    mockHardwareService.createHardware.mockRejectedValue(new Error('fail'))
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('+ Add Hardware'))
    await u.click(screen.getByText('+ Add Hardware'))
    await u.type(screen.getByLabelText('Name *'), 'Fail Item')
    await u.click(screen.getByText('Create'))
    await waitFor(() => expect(screen.getByText(/failed to save hardware/i)).toBeInTheDocument())
  })

  /* ---- Edit hardware ---- */
  it('opens edit modal with pre-filled data and updates', async () => {
    mockHardwareService.getHardware.mockResolvedValue([hinge])
    mockHardwareService.updateHardware.mockResolvedValue({ ...hinge, name: 'Updated Hinge' })
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Blum Hinge 110°'))

    // Click edit on the card
    await u.click(screen.getByText('Edit'))
    expect(screen.getByRole('dialog', { name: /edit hardware/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Name *')).toHaveValue('Blum Hinge 110°')

    const nameInput = screen.getByLabelText('Name *')
    await u.clear(nameInput)
    await u.type(nameInput, 'Updated Hinge')
    await u.click(screen.getByText('Update'))

    await waitFor(() => {
      expect(mockHardwareService.updateHardware).toHaveBeenCalledWith('hw-1', expect.objectContaining({
        name: 'Updated Hinge',
      }))
    })
  })

  /* ---- Delete hardware ---- */
  it('opens delete confirmation and deletes', async () => {
    mockHardwareService.getHardware.mockResolvedValue([hinge])
    mockHardwareService.deleteHardware.mockResolvedValue(undefined)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Blum Hinge 110°'))

    await u.click(screen.getByText('Delete'))
    expect(screen.getByRole('dialog', { name: /confirm delete/i })).toBeInTheDocument()
    expect(screen.getByText(/blum hinge 110/i)).toBeInTheDocument()

    await u.click(screen.getAllByText('Delete')[1]) // the confirm button
    await waitFor(() => expect(mockHardwareService.deleteHardware).toHaveBeenCalledWith('hw-1'))
  })

  it('cancels delete confirmation', async () => {
    mockHardwareService.getHardware.mockResolvedValue([hinge])
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Blum Hinge 110°'))
    await u.click(screen.getByText('Delete'))
    expect(screen.getByRole('dialog', { name: /confirm delete/i })).toBeInTheDocument()
    await u.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /confirm delete/i })).not.toBeInTheDocument())
    expect(mockHardwareService.deleteHardware).not.toHaveBeenCalled()
  })

  /* ---- Close add modal ---- */
  it('closes add modal on cancel', async () => {
    mockHardwareService.getHardware.mockResolvedValue([])
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('+ Add Hardware'))
    await u.click(screen.getByText('+ Add Hardware'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await u.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
