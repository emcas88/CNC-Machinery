import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MachineSetup from './MachineSetup'

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockMachinesService = {
  getMachines: vi.fn(),
  getMachine: vi.fn(),
  createMachine: vi.fn(),
  updateMachine: vi.fn(),
  deleteMachine: vi.fn(),
  getToolSets: vi.fn(),
  createToolSet: vi.fn(),
}

vi.mock('@/services/machines', () => ({ machinesService: mockMachinesService }))

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const toolSet1 = { id: 'ts-1', name: 'Default Tools', machineId: 'mc-1' }
const toolSet2 = { id: 'ts-2', name: 'Finishing Set', machineId: 'mc-1' }

const machine1 = {
  id: 'mc-1',
  name: 'Biesse Rover A',
  type: 'cnc_router',
  manufacturer: 'Biesse',
  model: 'Rover A 1632',
  serialNumber: 'SN-001',
  tableWidth: 3200,
  tableHeight: 1600,
  maxCutDepth: 60,
  spindleCount: 1,
  toolPositions: 12,
  postProcessorId: 'biesse-rov',
  ipAddress: '192.168.1.50',
  notes: 'Main production router',
  isActive: true,
  atcToolSets: [toolSet1, toolSet2],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
}

const machine2 = {
  id: 'mc-2',
  name: 'Holzher Panel Saw',
  type: 'panel_saw',
  manufacturer: 'Holzher',
  model: 'Cut 6120',
  tableWidth: 4200,
  tableHeight: 2100,
  maxCutDepth: 80,
  spindleCount: 1,
  toolPositions: 1,
  isActive: false,
  atcToolSets: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
}

const allMachines = [machine1, machine2]

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
      <MachineSetup />
    </QueryClientProvider>,
  )
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('MachineSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMachinesService.getToolSets.mockResolvedValue([toolSet1, toolSet2])
  })

  /* ---- Loading ---- */
  it('shows loading spinner while fetching machines', () => {
    mockMachinesService.getMachines.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  /* ---- Error ---- */
  it('shows error state with retry button', async () => {
    mockMachinesService.getMachines.mockRejectedValue(new Error('fail'))
    renderPage()
    await waitFor(() => expect(screen.getByText(/failed to load machines/i)).toBeInTheDocument())
    expect(screen.getByText(/retry/i)).toBeInTheDocument()
  })

  it('retries on Retry click', async () => {
    mockMachinesService.getMachines.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce([])
    renderPage()
    await waitFor(() => screen.getByText(/retry/i))
    fireEvent.click(screen.getByText(/retry/i))
    await waitFor(() => expect(mockMachinesService.getMachines).toHaveBeenCalledTimes(2))
  })

  /* ---- Empty state ---- */
  it('shows empty state when no machines exist', async () => {
    mockMachinesService.getMachines.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText(/no machines configured/i)).toBeInTheDocument())
  })

  /* ---- Renders machines ---- */
  it('renders machine list and selects first by default', async () => {
    mockMachinesService.getMachines.mockResolvedValue(allMachines)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover A')).toBeInTheDocument()
      expect(screen.getByText('Holzher Panel Saw')).toBeInTheDocument()
    })
    // Detail panel for first machine
    expect(screen.getByText('Rover A 1632')).toBeInTheDocument()
    expect(screen.getByText('3200 × 1600 mm')).toBeInTheDocument()
    expect(screen.getByText('192.168.1.50')).toBeInTheDocument()
    expect(screen.getByText('Main production router')).toBeInTheDocument()
  })

  it('shows machine specs: spindle count, tool positions, cut depth', async () => {
    mockMachinesService.getMachines.mockResolvedValue([machine1])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('60 mm')).toBeInTheDocument() // max cut depth
      expect(screen.getByText('12')).toBeInTheDocument()    // tool positions
    })
  })

  it('shows active/inactive status', async () => {
    mockMachinesService.getMachines.mockResolvedValue(allMachines)
    renderPage()
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument())
  })

  /* ---- Switch selection ---- */
  it('switches to another machine on click', async () => {
    mockMachinesService.getMachines.mockResolvedValue(allMachines)
    mockMachinesService.getToolSets.mockResolvedValue([])
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Biesse Rover A'))
    await u.click(screen.getByText('Holzher Panel Saw'))
    await waitFor(() => {
      expect(screen.getByText('Cut 6120')).toBeInTheDocument()
      expect(screen.getByText('4200 × 2100 mm')).toBeInTheDocument()
    })
  })

  /* ---- ATC Tool Sets ---- */
  it('renders ATC tool sets', async () => {
    mockMachinesService.getMachines.mockResolvedValue([machine1])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Default Tools')).toBeInTheDocument()
      expect(screen.getByText('Finishing Set')).toBeInTheDocument()
    })
  })

  it('creates a new tool set', async () => {
    mockMachinesService.getMachines.mockResolvedValue([machine1])
    mockMachinesService.createToolSet.mockResolvedValue({ id: 'ts-3', name: 'Roughing', machineId: 'mc-1' })
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('ATC Tool Sets'))

    await u.type(screen.getByLabelText('New tool set name'), 'Roughing')
    await u.click(screen.getByText('Add'))

    await waitFor(() => {
      expect(mockMachinesService.createToolSet).toHaveBeenCalledWith('mc-1', 'Roughing')
    })
  })

  it('shows error when tool set creation fails', async () => {
    mockMachinesService.getMachines.mockResolvedValue([machine1])
    mockMachinesService.createToolSet.mockRejectedValue(new Error('fail'))
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('ATC Tool Sets'))
    await u.type(screen.getByLabelText('New tool set name'), 'Fail')
    await u.click(screen.getByText('Add'))
    await waitFor(() => expect(screen.getByText(/failed to create tool set/i)).toBeInTheDocument())
  })

  it('shows empty tool sets message', async () => {
    mockMachinesService.getMachines.mockResolvedValue([{ ...machine1, atcToolSets: [] }])
    mockMachinesService.getToolSets.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText(/no tool sets configured/i)).toBeInTheDocument())
  })

  /* ---- Safety settings ---- */
  it('renders safety toggle switches', async () => {
    mockMachinesService.getMachines.mockResolvedValue([machine1])
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /soft limits/i })).toBeInTheDocument()
      expect(screen.getByRole('switch', { name: /spindle warmup/i })).toBeInTheDocument()
      expect(screen.getByRole('switch', { name: /dust collection/i })).toBeInTheDocument()
      expect(screen.getByRole('switch', { name: /e-stop test/i })).toBeInTheDocument()
    })
  })

  it('toggles safety settings', async () => {
    mockMachinesService.getMachines.mockResolvedValue([machine1])
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByRole('switch', { name: /e-stop test/i }))
    const toggle = screen.getByRole('switch', { name: /e-stop test/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await u.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  /* ---- Create machine ---- */
  it('opens add modal and creates machine', async () => {
    mockMachinesService.getMachines.mockResolvedValue([])
    mockMachinesService.createMachine.mockResolvedValue({ ...machine1, id: 'mc-new' })
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('+ New Machine'))
    await u.click(screen.getByText('+ New Machine'))

    expect(screen.getByRole('dialog', { name: /add machine/i })).toBeInTheDocument()

    await u.type(screen.getByLabelText('Name *'), 'New Router')
    await u.selectOptions(screen.getByLabelText('Type'), 'cnc_router')

    const twInput = screen.getByLabelText('Table Width (mm) *')
    await u.clear(twInput)
    await u.type(twInput, '2400')

    const thInput = screen.getByLabelText('Table Height (mm) *')
    await u.clear(thInput)
    await u.type(thInput, '1200')

    await u.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockMachinesService.createMachine).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Router',
        type: 'cnc_router',
        tableWidth: 2400,
        tableHeight: 1200,
      }))
    })
  })

  it('shows error when create fails', async () => {
    mockMachinesService.getMachines.mockResolvedValue([])
    mockMachinesService.createMachine.mockRejectedValue(new Error('fail'))
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('+ New Machine'))
    await u.click(screen.getByText('+ New Machine'))
    await u.type(screen.getByLabelText('Name *'), 'Fail Machine')

    const twInput = screen.getByLabelText('Table Width (mm) *')
    await u.clear(twInput)
    await u.type(twInput, '100')

    const thInput = screen.getByLabelText('Table Height (mm) *')
    await u.clear(thInput)
    await u.type(thInput, '100')

    await u.click(screen.getByText('Create'))
    await waitFor(() => expect(screen.getByText(/failed to save machine/i)).toBeInTheDocument())
  })

  /* ---- Edit machine ---- */
  it('opens edit modal with pre-filled data and updates', async () => {
    mockMachinesService.getMachines.mockResolvedValue([machine1])
    mockMachinesService.updateMachine.mockResolvedValue({ ...machine1, name: 'Updated Router' })
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Biesse Rover A'))

    // Click edit on detail panel
    await u.click(screen.getByText('Edit'))
    expect(screen.getByRole('dialog', { name: /edit machine/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Name *')).toHaveValue('Biesse Rover A')

    const nameInput = screen.getByLabelText('Name *')
    await u.clear(nameInput)
    await u.type(nameInput, 'Updated Router')
    await u.click(screen.getByText('Update'))

    await waitFor(() => {
      expect(mockMachinesService.updateMachine).toHaveBeenCalledWith('mc-1', expect.objectContaining({
        name: 'Updated Router',
      }))
    })
  })

  /* ---- Delete machine ---- */
  it('deletes machine after confirmation', async () => {
    mockMachinesService.getMachines.mockResolvedValue([machine1])
    mockMachinesService.deleteMachine.mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Delete'))
    await u.click(screen.getByText('Delete'))
    await waitFor(() => expect(mockMachinesService.deleteMachine).toHaveBeenCalledWith('mc-1'))
  })

  it('does not delete when confirmation is cancelled', async () => {
    mockMachinesService.getMachines.mockResolvedValue([machine1])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Delete'))
    await u.click(screen.getByText('Delete'))
    expect(mockMachinesService.deleteMachine).not.toHaveBeenCalled()
  })

  /* ---- Close modal ---- */
  it('closes add modal on cancel', async () => {
    mockMachinesService.getMachines.mockResolvedValue([])
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('+ New Machine'))
    await u.click(screen.getByText('+ New Machine'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await u.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  /* ---- All form fields render ---- */
  it('renders all form fields in the create modal', async () => {
    mockMachinesService.getMachines.mockResolvedValue([])
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('+ New Machine'))
    await u.click(screen.getByText('+ New Machine'))

    expect(screen.getByLabelText('Name *')).toBeInTheDocument()
    expect(screen.getByLabelText('Type')).toBeInTheDocument()
    expect(screen.getByLabelText('Manufacturer')).toBeInTheDocument()
    expect(screen.getByLabelText('Model')).toBeInTheDocument()
    expect(screen.getByLabelText('Serial Number')).toBeInTheDocument()
    expect(screen.getByLabelText('Table Width (mm) *')).toBeInTheDocument()
    expect(screen.getByLabelText('Table Height (mm) *')).toBeInTheDocument()
    expect(screen.getByLabelText('Max Cut Depth (mm)')).toBeInTheDocument()
    expect(screen.getByLabelText('Spindle Count')).toBeInTheDocument()
    expect(screen.getByLabelText('Tool Positions')).toBeInTheDocument()
    expect(screen.getByLabelText('Post Processor ID')).toBeInTheDocument()
    expect(screen.getByLabelText('IP Address')).toBeInTheDocument()
    expect(screen.getByLabelText('Notes')).toBeInTheDocument()
  })
})
