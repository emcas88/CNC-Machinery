import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DovetailSetup from './DovetailSetup';
import { machinesService } from '@/services/machines';
import type { Machine } from '@/types';

vi.mock('@/services/machines', () => ({
  machinesService: {
    getMachines: vi.fn(),
    getMachine: vi.fn(),
    updateMachine: vi.fn(),
  },
}));

const mockMachines: Machine[] = [
  {
    id: 'mach-1',
    name: 'Biesse Rover A',
    notes: JSON.stringify({
      __dovetailConfig: {
        bitAngle: 11,
        bitDiameter: 12.7,
        socketDepth: 10,
        pinSize: 8,
        tailSize: 20,
        halfPinSize: 5,
        halfPinEnabled: true,
        drawerWidth: 350,
        drawerHeight: 100,
        drawerDepth: 400,
        materialThickness: 12.7,
        xOffset: 1.5,
        yOffset: 0.5,
        zClearance: 5,
        feedRate: 2500,
        plungeRate: 1200,
      },
    }),
  } as unknown as Machine,
  {
    id: 'mach-2',
    name: 'SCM Morbidelli',
    notes: 'Some plain text notes',
  } as unknown as Machine,
  {
    id: 'mach-3',
    name: 'Homag Venture',
    notes: undefined,
  } as unknown as Machine,
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('DovetailSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (machinesService.getMachines as ReturnType<typeof vi.fn>).mockResolvedValue(mockMachines);
  });

  // ── Loading State ──
  it('shows loading spinner while fetching machines', () => {
    (machinesService.getMachines as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<DovetailSetup />, { wrapper: createWrapper() });
    expect(screen.getByText('Loading machines…')).toBeInTheDocument();
  });

  // ── Error State ──
  it('shows error state when fetch fails', async () => {
    (machinesService.getMachines as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Connection refused'),
    );
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Failed to load machines')).toBeInTheDocument();
    });
    expect(screen.getByText('Connection refused')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  // ── Empty machines ──
  it('shows empty state when no machines configured', async () => {
    (machinesService.getMachines as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('No machines configured')).toBeInTheDocument();
    });
  });

  // ── Renders with first machine selected ──
  it('auto-selects the first machine and loads its config', async () => {
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });
    // Biesse Rover A has saved config with bitAngle 11
    const angle11 = screen.getByText('11°');
    expect(angle11.className).toContain('bg-cyan-600');
  });

  // ── Machine selector ──
  it('renders machine selector with all machines', async () => {
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toBe('Biesse Rover A');
    expect(options[1].textContent).toBe('SCM Morbidelli');
    expect(options[2].textContent).toBe('Homag Venture');
  });

  // ── Load saved config ──
  it('loads saved dovetail config from machine notes', async () => {
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });
    // Socket depth from saved config = 10
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    // Feed rate from saved config = 2500
    expect(screen.getByDisplayValue('2500')).toBeInTheDocument();
    // Plunge rate from saved config = 1200
    expect(screen.getByDisplayValue('1200')).toBeInTheDocument();
  });

  // ── Switch machines loads defaults for unconfigured ──
  it('loads defaults when switching to a machine without dovetail config', async () => {
    const user = userEvent.setup();
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'mach-2');

    // Should load defaults: bitAngle=14, feedRate=3000
    await waitFor(() => {
      expect(screen.getByDisplayValue('3000')).toBeInTheDocument();
    });
    const angle14 = screen.getByText('14°');
    expect(angle14.className).toContain('bg-cyan-600');
  });

  // ── Bit angle selection ──
  it('changes bit angle on button click', async () => {
    const user = userEvent.setup();
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });

    await user.click(screen.getByText('7°'));
    expect(screen.getByText('7°').className).toContain('bg-cyan-600');
    expect(screen.getByText('11°').className).not.toContain('bg-cyan-600');
  });

  // ── Numeric field changes ──
  it('updates bit diameter numeric field', async () => {
    const user = userEvent.setup();
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });

    const bitDiameterInput = screen.getByDisplayValue('12.7');
    await user.clear(bitDiameterInput);
    await user.type(bitDiameterInput, '15');
    expect(bitDiameterInput).toHaveValue(15);
  });

  // ── Unsaved changes indicator ──
  it('shows unsaved changes indicator when form is modified', async () => {
    const user = userEvent.setup();
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });

    expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
    await user.click(screen.getByText('7°'));
    expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
  });

  // ── Save config ──
  it('saves dovetail config to machine notes via API', async () => {
    const user = userEvent.setup();
    (machinesService.updateMachine as ReturnType<typeof vi.fn>).mockResolvedValue(mockMachines[0]);

    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });

    // Make a change to enable save
    await user.click(screen.getByText('9°'));
    await user.click(screen.getByText('Save Dovetail Config'));

    await waitFor(() => {
      expect(machinesService.updateMachine).toHaveBeenCalledWith(
        'mach-1',
        expect.objectContaining({
          notes: expect.stringContaining('__dovetailConfig'),
        }),
      );
    });

    // Verify the saved config has the new angle
    const savedNotes = (machinesService.updateMachine as ReturnType<typeof vi.fn>).mock.calls[0][1].notes;
    const parsed = JSON.parse(savedNotes);
    expect(parsed.__dovetailConfig.bitAngle).toBe(9);
  });

  // ── Save disabled when no changes ──
  it('disables save button when no changes', async () => {
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });
    const saveButton = screen.getByText('Save Dovetail Config');
    expect(saveButton).toBeDisabled();
  });

  // ── Save error ──
  it('shows error when save fails', async () => {
    const user = userEvent.setup();
    (machinesService.updateMachine as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Write failed'),
    );

    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });

    await user.click(screen.getByText('7°'));
    await user.click(screen.getByText('Save Dovetail Config'));

    await waitFor(() => {
      expect(screen.getByText(/Failed to save/)).toBeInTheDocument();
    });
  });

  // ── Reset to defaults ──
  it('resets all fields to factory defaults', async () => {
    const user = userEvent.setup();
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });

    // Current config has feedRate=2500 from saved
    expect(screen.getByDisplayValue('2500')).toBeInTheDocument();

    await user.click(screen.getByText('Reset to Defaults'));

    // Should now show default feedRate=3000
    expect(screen.getByDisplayValue('3000')).toBeInTheDocument();
    // Default bitAngle=14
    expect(screen.getByText('14°').className).toContain('bg-cyan-600');
  });

  // ── Half pin toggle ──
  it('toggles half pin settings', async () => {
    const user = userEvent.setup();
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });

    // Half pins enabled by default on mach-1
    expect(screen.getByText('Half Pins')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', { name: /half pins/i });
    expect(checkbox).toBeChecked();

    // Disable half pins
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  // ── SVG preview renders ──
  it('renders SVG dovetail preview', async () => {
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Joint Preview')).toBeInTheDocument();
    });
    const svg = screen.getByLabelText('Dovetail joint preview');
    expect(svg).toBeInTheDocument();
    expect(svg.tagName).toBe('svg');
  });

  // ── Preview shows stats ──
  it('displays joint dimension stats below preview', async () => {
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });

    expect(screen.getByText('Pins')).toBeInTheDocument();
    expect(screen.getByText('Tails')).toBeInTheDocument();
    expect(screen.getByText('Angle')).toBeInTheDocument();
    expect(screen.getByText('8mm')).toBeInTheDocument(); // pinSize from saved
    expect(screen.getByText('20mm')).toBeInTheDocument(); // tailSize from saved
    expect(screen.getByText('11°')).toBeInTheDocument(); // bitAngle from saved (also a button)
  });

  // ── Drawer box dimension inputs ──
  it('updates drawer box dimensions', async () => {
    const user = userEvent.setup();
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });

    const widthInput = screen.getByDisplayValue('350');
    await user.clear(widthInput);
    await user.type(widthInput, '500');
    expect(widthInput).toHaveValue(500);
  });

  // ── Machine offsets ──
  it('displays and updates machine offset fields', async () => {
    const user = userEvent.setup();
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Machine Offsets')).toBeInTheDocument();
    });

    // X offset from saved config = 1.5
    expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
    // Y offset = 0.5
    expect(screen.getByDisplayValue('0.5')).toBeInTheDocument();
  });

  // ── Preserves existing notes on save ──
  it('preserves non-dovetail notes content when saving', async () => {
    const user = userEvent.setup();
    (machinesService.updateMachine as ReturnType<typeof vi.fn>).mockResolvedValue(mockMachines[1]);

    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });

    // Switch to machine with plain text notes
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'mach-2');

    await waitFor(() => {
      // Should have loaded defaults since mach-2 has no dovetail config
      expect(screen.getByDisplayValue('3000')).toBeInTheDocument();
    });

    // Make a change and save
    await user.click(screen.getByText('9°'));
    await user.click(screen.getByText('Save Dovetail Config'));

    await waitFor(() => {
      expect(machinesService.updateMachine).toHaveBeenCalled();
    });

    const savedNotes = (machinesService.updateMachine as ReturnType<typeof vi.fn>).mock.calls[0][1].notes;
    const parsed = JSON.parse(savedNotes);
    // Should preserve original notes
    expect(parsed._originalNotes).toBe('Some plain text notes');
    expect(parsed.__dovetailConfig.bitAngle).toBe(9);
  });

  // ── Section headers ──
  it('renders all section headers', async () => {
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Bit Settings')).toBeInTheDocument();
    });
    expect(screen.getByText('Joint Dimensions')).toBeInTheDocument();
    expect(screen.getByText('Drawer Box Dimensions')).toBeInTheDocument();
    expect(screen.getByText('Machine Offsets')).toBeInTheDocument();
    expect(screen.getByText('Feed Rates')).toBeInTheDocument();
    expect(screen.getByText('Joint Preview')).toBeInTheDocument();
  });

  // ── Feed rate inputs ──
  it('updates feed and plunge rates', async () => {
    const user = userEvent.setup();
    render(<DovetailSetup />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dovetail Setup')).toBeInTheDocument();
    });

    const feedInput = screen.getByDisplayValue('2500');
    await user.clear(feedInput);
    await user.type(feedInput, '4000');
    expect(feedInput).toHaveValue(4000);
  });
});
